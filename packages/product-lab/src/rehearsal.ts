import { randomUUID, createHash } from "node:crypto";
import { lstat, mkdir, open, opendir, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { projectModelSchema } from "./schema.js";
import { readProjectContext } from "./workflow.js";
import { readJson, revision, withLock, workspace, writeArtifact } from "./storage.js";
import { findPublicPrices } from "./public-prices.js";
import { createInference } from "./inference.js";
import type { Infer, InferenceResult } from "./inference.js";
import { exploreAsViewer } from "./experience-agent.js";
import { validateLocalTarget } from "./journeys.js";
import { experienceSchema, optimizationSchema, rehearsalInputSchema, rehearsalPlanSchema, rehearsalStateSchema, viewerBatchSchema } from "./rehearsal-schema.js";
import type { RehearsalState, SyntheticViewer } from "./rehearsal-schema.js";

const active = new Map<string, { pause: boolean; task: Promise<void> }>();
export type RehearsalDependencies = { infer?: Infer; prices?: typeof findPublicPrices };
type Dependencies = RehearsalDependencies;
class Pause extends Error {}
const now = () => new Date().toISOString();
async function recordActivity(root: string, state: RehearsalState, label: string, kind: RehearsalState["activity"][number]["kind"]) {
  state.activity.push({ at: now(), label: label.slice(0, 400), kind });
  state.activity = state.activity.slice(-8);
  await persist(root, state);
}

async function persist(root: string, state: RehearsalState) {
  state.updatedAt = now();
  for (let attempt = 0; ; attempt++) {
    try {
      await withLock(root, async path => {
        const checked = rehearsalStateSchema.parse(state);
        await writeArtifact(await runDirectory(root, state.id), "state.json", checked);
        await writeArtifact(path, "rehearsal.json", checked);
      }); return;
    }
    catch (error) {
      if (attempt >= 50 || !(error instanceof Error) || !error.message.startsWith("Another Hypothra operation")) throw error;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
}

async function runDirectory(root: string, id: string, create = false) {
  z.string().uuid().parse(id);
  const path = join(await workspace(root), `rehearsal-${id}`);
  if (create) await mkdir(path);
  if ((await lstat(path)).isSymbolicLink() || await realpath(path) !== path) throw new Error("Rehearsal artifact directory must not be a link.");
  return path;
}

export async function readRehearsal(root: string): Promise<RehearsalState | null> {
  try {
    const current = await readJson(join(await workspace(root), "rehearsal.json"), rehearsalStateSchema);
    const state = await readJson(join(await runDirectory(root, current.id), "state.json"), rehearsalStateSchema);
    if (state.id !== current.id) throw new Error("Run archive does not match the selected rehearsal.");
    return state;
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export function validateRehearsalPlan(input: unknown, state: RehearsalState, evidenceIds: Set<string>) {
  const plan = rehearsalPlanSchema.parse(input);
  for (const entries of [plan.segments, plan.channels]) if (Math.abs(entries.reduce((sum, item) => sum + item.share, 0) - 1) > 0.001) throw new Error("Audience and channel shares must each sum to 1.");
  if (new Set(plan.segments.map(item => item.id)).size !== plan.segments.length) throw new Error("Audience segment IDs must be unique.");
  for (const cost of plan.costs) if (cost.evidenceIds.some(id => !evidenceIds.has(id))) throw new Error("AI costs referred to nonexistent source evidence.");
  for (const channel of plan.channels) if (channel.benchmarkId && !state.market.benchmarks.some(item => item.id === channel.benchmarkId && item.platform === channel.platform && item.currency === state.input.currency && item.metric === "cpm")) throw new Error("AI invented or mismatched an advertising price source.");
  return plan;
}

export function validateViewerBatch(input: unknown, assigned: { id: string; segmentId: string }[]): SyntheticViewer[] {
  const { viewers } = viewerBatchSchema.parse(input), expected = new Map(assigned.map(item => [item.id, item.segmentId]));
  if (viewers.length !== assigned.length || new Set(viewers.map(item => item.id)).size !== viewers.length) throw new Error("AI must return exactly one individual decision for every assigned viewer.");
  for (const viewer of viewers) {
    if (expected.get(viewer.id) !== viewer.segmentId) throw new Error("AI changed an assigned viewer or audience segment.");
    if (viewer.install && !viewer.click || viewer.click && !viewer.watch) throw new Error("Individual decisions must follow watch → click → install.");
  }
  return viewers.sort((a, b) => assigned.findIndex(item => item.id === a.id) - assigned.findIndex(item => item.id === b.id));
}

function assignedViewers(state: RehearsalState) {
  const count = Math.min(state.input.batchSize, state.input.viewers - state.audience.evaluated);
  return Array.from({ length: count }, (_, index) => {
    const id = `v${String(state.audience.evaluated + index + 1).padStart(6, "0")}`;
    const value = Number.parseInt(createHash("sha256").update(`${state.id}:${id}`).digest("hex").slice(0, 8), 16) / 0x1_0000_0000;
    let sum = 0;
    const segment = state.plan!.segments.find(item => { sum += item.share; return value < sum; }) ?? state.plan!.segments.at(-1)!;
    return { id, segmentId: segment.id };
  });
}

async function assertUnchanged(root: string, state: RehearsalState) {
  const model = await readJson(join(await workspace(root), "project.json"), projectModelSchema);
  if (revision(model) !== state.modelRevision) throw new Error("The product model changed. Prepare a new virtual launch so different revisions are not mixed.");
}

function trackedInference(root: string, state: RehearsalState, infer: Infer): Infer {
  return async <T>(schema: z.ZodType<T>, instructions: string, data: unknown): Promise<InferenceResult<T>> => {
    if (state.calls.attempted >= state.input.maxAICalls) throw new Pause("AI request limit reached. Increase the limit to resume; completed decisions are saved.");
    await assertUnchanged(root, state);
    state.calls.attempted++;
    await persist(root, state);
    const result = await infer(schema, instructions, data);
    state.calls.completed++; state.calls.provider = result.provider; state.calls.model = result.model;
    if (result.usage) { state.calls.inputTokens += result.usage.inputTokens; state.calls.outputTokens += result.usage.outputTokens; }
    else state.calls.usageUnreported++;
    await persist(root, state);
    return result;
  };
}

async function lease(root: string) {
  const path = await workspace(root), file = join(path, ".rehearsal-run.lock"), gatePath = join(path, ".rehearsal-gate.lock");
  let gate;
  try { gate = await open(gatePath, "wx"); }
  catch { throw new Error("Another virtual launch control operation is active. Retry shortly; inspect .hypothra/.rehearsal-gate.lock if the process crashed."); }
  let handle;
  try {
    try {
      const previous = await readJson(file, z.object({ pid: z.number().int().positive(), createdAt: z.string() }).strict(), 4096);
      let alive = true;
      try { process.kill(previous.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false; }
      if (alive) throw new Error("A virtual launch is already active in a running process.");
      await unlink(file); // Known dead owner; the gate serializes all lease changes.
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    handle = await open(file, "wx");
    await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: now() }));
  } finally { await gate.close(); await unlink(gatePath); }
  return async () => { await handle.close(); await unlink(file); };
}

export async function rehearsalWorkerState(root: string): Promise<"local" | "other-process" | "interrupted" | "idle"> {
  if (active.has(await realpath(root))) return "local";
  try {
    const owner = await readJson(join(await workspace(root), ".rehearsal-run.lock"), z.object({ pid: z.number().int().positive(), createdAt: z.string() }).strict(), 4096);
    try { process.kill(owner.pid, 0); return "other-process"; }
    catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH" ? "interrupted" : "other-process"; }
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return "idle"; throw error; }
}

export async function rehearsalHistory(root: string) {
  const history = [];
  let inspected = 0;
  for await (const entry of await opendir(await workspace(root))) {
    if (++inspected > 2000) break;
    if (!entry.isDirectory() || !/^rehearsal-[a-f0-9-]{36}$/.test(entry.name)) continue;
    const id = entry.name.slice(10);
    const state = await readJson(join(await runDirectory(root, id), "state.json"), rehearsalStateSchema);
    history.push({ id: state.id, name: state.plan?.name ?? "Planning", createdAt: state.createdAt, status: state.status,
      evaluated: state.audience.evaluated, installed: state.audience.installed, tested: state.experience.tested, modelRevision: state.modelRevision });
    if (history.length >= 100) break;
  }
  return history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function work(root: string, state: RehearsalState, release: () => Promise<void>, task: (infer: Infer, pause: () => boolean) => Promise<void>, deps: Dependencies) {
  const control = { pause: false, task: Promise.resolve() };
  active.set(root, control);
  control.task = (async () => {
    try { await task(trackedInference(root, state, deps.infer ?? createInference(root)), () => control.pause); }
    catch (error) { state.status = error instanceof Pause ? "paused" : "failed"; state.message = error instanceof Error ? error.message.slice(0, 1400) : "The virtual launch stopped. Completed records were preserved."; await persist(root, state); }
    finally { active.delete(root); await release(); }
  })();
  void control.task.catch(() => {});
}

export async function prepareRehearsal(directory: string, input: unknown, deps: Dependencies = {}) {
  const root = await realpath(directory), context = await readProjectContext(root), config = rehearsalInputSchema.parse(input);
  const release = await lease(root);
  try {
    const state: RehearsalState = { schemaVersion: 1, id: randomUUID(), modelRevision: context.revision, sourceDigest: context.inspection.sourceDigest,
      createdAt: now(), updatedAt: now(), status: "planning", phase: "planning", message: "AI is researching published prices and proposing the audience, creative and launch costs.",
      input: config, plan: null, market: { benchmarks: [], checkedAt: now().slice(0, 10), error: null },
      audience: { evaluated: 0, watched: 0, clicked: 0, installed: 0, batches: 0, reasons: {}, samples: [] },
      experience: { baseUrl: null, consent: false, target: 0, tested: 0, satisfied: 0, dropout: 0, blocked: 0, stepLimit: 0, issues: {}, samples: [] },
      calls: { attempted: 0, completed: 0, inputTokens: 0, outputTokens: 0, usageUnreported: 0, provider: null, model: null }, optimization: null, planningStep: "research", runStartedAt: now(), activity: [{ at: now(), label: "Checking published advertising price references", kind: "research" }],
      limitations: ["Every counted viewer has an individually generated AI decision. A batch may share a model call; these are not independently validated human responses.",
        "Increasing sample size does not remove model bias or calibrate real market conversion. No population confidence interval is claimed.",
        "AI proposes audience composition, costs and budget as editable hypotheses. Published prices retain their source, period and market scope.",
        "The creative is a script or description. No video was watched, audio heard, or platform delivery algorithm reproduced.",
        "No ads are bought. Model calls consume the configured AI account. Monetary AI charges are unknown; reported tokens and requests are counted.",
        "App-stage opinions are synthetic. Browser actions and errors are recorded separately and do not establish real retention or load capacity.",
        "Only selected source evidence is available to AI; an incomplete project scan remains incomplete."] };
    await runDirectory(root, state.id, true); await persist(root, state);
    work(root, state, release, async infer => {
      try { const prices = await (deps.prices ?? findPublicPrices)(config.currency); state.market.benchmarks = prices.benchmarks.filter(item => item.metric === "cpm"); state.market.checkedAt = prices.checkedAt; }
      catch { state.market.error = "Published ad prices could not be verified. Media costs remain unknown; no invented market price is substituted."; }
      state.planningStep = "compose";
      await recordActivity(root, state, state.market.error ? "Price references unavailable — keeping media costs unknown" : "Published price references checked", "saved");
      await recordActivity(root, state, "AI is writing the creative, audience and cost proposal", "thinking");
      const plan = (await infer(rehearsalPlanSchema,
        "Prepare a complete virtual product launch without asking the owner to fill a funnel form. Propose the audience, 2–12 diverse segments including skeptical and irrelevant viewers, a concise reel script/hook/CTA, business costs and a budget. Respect owner constraints. All segment shares and channel shares must each sum to 1. Costs must have basis ai-estimate; source-derived ideas may cite only supplied evidence IDs. Only supplied published CPM benchmark IDs may be used for channels, otherwise benchmarkId=null. Never invent observed advertising prices. Format is script-only or ad-description-only: explicitly state that no actual video or audio was analyzed. Distinguish product-source facts, cost guesses and uncertainties. No user-supplied CTR or conversion rate is needed. Do not add rate assumptions or forecast fake counts.",
        { project: context.model, evidence: context.inspection.evidence.slice(0, 120), request: config, publicPrices: state.market })).value;
      state.plan = validateRehearsalPlan(plan, state, new Set(context.inspection.evidence.map(item => item.id)));
      state.status = "ready"; state.phase = "audience"; state.planningStep = "ready"; state.message = "AI prepared the plan. Review or edit it, confirm your product, then start the individual audience evaluations.";
      await recordActivity(root, state, "Your launch plan is saved and ready to review", "ready");
    }, deps);
    return structuredClone(state);
  } catch (error) { await release(); throw error; }
}

export async function editRehearsalPlan(directory: string, runId: string, input: unknown) {
  const root = await realpath(directory), release = await lease(root);
  try {
    const state = await readRehearsal(root), context = await readProjectContext(root);
    if (!state || state.id !== runId || state.audience.evaluated || state.phase !== "audience" || state.modelRevision !== context.revision) throw new Error("Only the current unevaluated plan can be edited.");
    state.plan = validateRehearsalPlan(input, state, new Set(context.inspection.evidence.map(item => item.id)));
    state.status = "ready"; await persist(root, state); return state;
  } finally { await release(); }
}

export async function pauseRehearsal(directory: string, runId: string) {
  const root = await realpath(directory), state = await readRehearsal(root), control = active.get(root);
  if (!state || state.id !== runId || !control) throw new Error("This virtual launch is not running in this process.");
  control.pause = true;
  return { message: "Pausing after the current batch or browser visitor. Completed records are preserved." };
}

export async function configureExperience(directory: string, runId: string, input: unknown) {
  const config = z.object({ baseUrl: z.string(), users: z.number().int().min(1).max(5000), syntheticTestData: z.literal(true) }).strict().parse(input);
  validateLocalTarget(config.baseUrl);
  const root = await realpath(directory), release = await lease(root);
  try {
    const state = await readRehearsal(root);
    if (!state || state.id !== runId || state.audience.evaluated !== state.input.viewers || !state.audience.installed) throw new Error("Finish the audience stage with interested installers before testing the app.");
    if (state.experience.tested && state.experience.baseUrl !== config.baseUrl) throw new Error("Start a new rehearsal to change the app after tests have been recorded.");
    const target = Math.min(config.users, state.audience.installed);
    if (target <= state.experience.tested) throw new Error("These visitors have already been tested. Increase the target to explore more individually evaluated installers.");
    state.experience.baseUrl = config.baseUrl; state.experience.target = target; state.experience.consent = true;
    state.phase = "experience"; state.status = "ready"; state.optimization = null; state.message = "Local app exploration is ready. Each tested visitor will make AI decisions using observed page content.";
    await persist(root, state); return state;
  } finally { await release(); }
}

export async function resumeRehearsal(directory: string, runId: string, options: { maxAICalls?: number } & Dependencies = {}) {
  const root = await realpath(directory), context = await readProjectContext(root, true), release = await lease(root);
  try {
    const state = await readRehearsal(root);
    if (!state || state.id !== runId || !state.plan || state.modelRevision !== context.revision || state.sourceDigest !== context.inspection.sourceDigest) throw new Error("Review the current product and prepare a matching AI launch plan first.");
    if (state.phase === "complete") throw new Error("This run is complete. Add local app exploration or prepare a new launch variant.");
    if (options.maxAICalls !== undefined) state.input.maxAICalls = rehearsalInputSchema.shape.maxAICalls.parse(options.maxAICalls);
    state.status = "running"; state.runStartedAt = now(); state.message = "AI is evaluating individual synthetic people. Counts include completed records only.";
    await persist(root, state);
    work(root, state, release, async (infer, paused) => {
      const directory = await runDirectory(root, state.id);
      const checkpoint = () => { if (paused()) throw new Pause("Paused. Resume to continue from the last completed record."); };
      if (state.phase === "audience") {
        while (state.audience.evaluated < state.input.viewers) {
          checkpoint();
          const assigned = assignedViewers(state), name = `audience-${state.audience.batches}.json`;
          let viewers: SyntheticViewer[];
          try { viewers = validateViewerBatch(await readJson(join(directory, name)), assigned); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            await recordActivity(root, state, `AI is evaluating viewers ${assigned[0]!.id}–${assigned.at(-1)!.id}`, "thinking");
            const result = (await infer(viewerBatchSchema,
              "For EACH assigned ID create one distinct synthetic person within its assigned segment and make that person's own watch/click/install decisions about the creative. Develop a concrete personal context, need, objection and attention level. Do not use a target conversion percentage, multiply a funnel, repeat one verdict, balance outcomes to a quota, or extrapolate unexamined people. Include indifferent and skeptical people when appropriate to their segment. Watch means staying for the pitch; click requires watch; install means deciding to try/download after the click and requires click. It is a synthetic intent, not an observed download. Return exactly the assigned IDs and segment IDs, with an individual reason and expectation for each. Do not claim actual video viewing or real market measurements.",
              { project: context.model.project, plan: state.plan, assigned })).value;
            viewers = validateViewerBatch(result, assigned);
            await writeArtifact(directory, name, { viewers });
          }
          for (const viewer of viewers) {
            state.audience.evaluated++; if (viewer.watch) state.audience.watched++; if (viewer.click) state.audience.clicked++; if (viewer.install) state.audience.installed++;
            state.audience.reasons[viewer.reasonCode] = (state.audience.reasons[viewer.reasonCode] ?? 0) + 1;
            if (state.audience.samples.length < 24) state.audience.samples.push(viewer);
          }
          state.audience.batches++; await recordActivity(root, state, `${state.audience.evaluated.toLocaleString()} individual reactions saved`, "saved");
        }
        state.phase = "optimization"; await persist(root, state);
      }
      if (state.phase === "experience") {
        if (!state.experience.consent || !state.experience.baseUrl) throw new Error("Local app testing requires an explicit test address and synthetic-data confirmation.");
        let seen = 0;
        outer: for (let batch = 0; batch < state.audience.batches; batch++) {
          const { viewers } = await readJson(join(directory, `audience-${batch}.json`), viewerBatchSchema);
          for (const viewer of viewers.filter(item => item.install)) {
            if (seen++ < state.experience.tested) continue;
            if (state.experience.tested >= state.experience.target) break outer;
            checkpoint();
            const name = `experience-${viewer.id}.json`;
            let result;
            try { result = await readJson(join(directory, name), experienceSchema); }
            catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
              result = await exploreAsViewer(viewer, context.model, state.experience.baseUrl, infer, state.id,
                async (label, kind) => recordActivity(root, state, `${viewer.id} · ${label}`, kind));
              await writeArtifact(directory, name, result);
            }
            if (result.viewerId !== viewer.id) throw new Error("Browser result refers to a different synthetic viewer.");
            state.experience.tested++;
            if (result.outcome === "satisfied") state.experience.satisfied++;
            else if (result.outcome === "dropout") state.experience.dropout++;
            else if (result.outcome === "blocked") state.experience.blocked++;
            else state.experience.stepLimit++;
            for (const error of result.runtimeErrors) {
              const key = state.experience.issues[error] || Object.keys(state.experience.issues).length < 100 ? error : "Additional runtime issue kinds";
              const issue = state.experience.issues[key] ?? { count: 0, exampleViewer: viewer.id };
              issue.count++; state.experience.issues[key] = issue;
            }
            if (state.experience.samples.length < 8) state.experience.samples.push(result);
            else if (result.runtimeErrors.some(error => !state.experience.samples.some(sample => sample.runtimeErrors.includes(error)))) state.experience.samples[7] = result;
            await recordActivity(root, state, `Browser visit saved for ${viewer.id} · ${result.outcome}`, "saved");
          }
        }
        state.phase = "optimization"; await persist(root, state);
      }
      checkpoint();
      await recordActivity(root, state, "AI is turning the saved reactions and observations into recommendations", "thinking");
      const evidence = [
        ...state.audience.samples.map(viewer => ({ id: `viewer:${viewer.id}`, basis: "synthetic-opinion", content: viewer })),
        ...state.experience.samples.flatMap(result => result.observations.map(observation => ({ id: `app:${result.viewerId}:${observation.id}`, basis: "observed-browser-result", content: { observation, actions: result.actions, runtimeErrors: result.runtimeErrors, opinion: result.feedback } }))),
        ...Object.entries(state.experience.issues).map(([error, issue]) => ({ id: `runtime:${createHash("sha256").update(error).digest("hex").slice(0, 16)}`, basis: "observed-browser-result", content: { error, ...issue } })),
      ];
      const optimization = (await infer(optimizationSchema,
        "Recommend concrete next creative, targeting and product changes. Use only supplied evidence IDs. Every recommendation needs evidence and the correct basis: viewer decisions/opinions are synthetic-opinion; actual page/action/error observations are observed-browser-result. An AI dropout opinion alone is not a reproduced software defect. Respect actual completed counts, not requested counts. Samples are the first bounded records, not representative sampling. Never treat virtual intent as real conversion, retention, customer quotes or load testing. Prioritize specific reproducible failures and testable marketing hypotheses. Include what an actual small market experiment should validate next.",
        { plan: state.plan, counts: state.audience, browserCounts: { ...state.experience, samples: undefined }, evidence })).value;
      const valid = new Map(evidence.map(item => [item.id, item.basis]));
      for (const item of optimization.recommendations) if (item.evidenceIds.some(id => valid.get(id) !== item.basis)) throw new Error("Optimization invented evidence or confused synthetic opinion with a browser observation.");
      // A final fresh scan catches source changes made during a long run.
      const current = await readProjectContext(root, true);
      if (current.revision !== state.modelRevision || current.inspection.sourceDigest !== state.sourceDigest) throw new Error("Project changed during the run. Results are retained, but must not be attributed to the current version.");
      state.optimization = optimization; state.phase = "complete"; state.status = "completed";
      state.message = "Virtual launch completed. Review individual AI decisions and the evidence behind each suggested change.";
      await recordActivity(root, state, "Your insights are ready", "ready");
    }, options);
    return structuredClone(state);
  } catch (error) { await release(); throw error; }
}

export async function waitForRehearsal(directory: string) {
  const root = await realpath(directory); await active.get(root)?.task; return readRehearsal(root);
}

export async function readRehearsalRecords(root: string, runId: string, batch: number) {
  const state = await readRehearsal(root);
  if (!state || state.id !== runId || !Number.isInteger(batch) || batch < 0 || batch >= state.audience.batches) throw new Error("Choose a completed audience batch from the current run.");
  return readJson(join(await runDirectory(root, runId), `audience-${batch}.json`), viewerBatchSchema);
}

export function mediaCostReference(state: RehearsalState) {
  if (!state.plan) return [];
  return state.plan.channels.map(channel => {
    const price = state.market.benchmarks.find(item => item.id === channel.benchmarkId);
    return { platform: channel.platform, benchmark: price ?? null, hypothesisViews: Math.round(state.input.viewers * channel.share),
      costForRequestedViews: price ? { low: state.input.viewers * channel.share / 1000 * price.price.low,
        typical: state.input.viewers * channel.share / 1000 * price.price.typical, high: state.input.viewers * channel.share / 1000 * price.price.high } : null };
  });
}
