import { join } from "node:path";
import { lstat, open } from "node:fs/promises";
import { z } from "zod";
import { inspectProject } from "@hypothra/project-scanner";
import type { Inspection } from "@hypothra/project-scanner";
import { projectModelSchema, launchPlanSchema, benchmarksSchema, journeysSchema, digestSchema, runtimeReportSchema } from "./schema.js";
import { proposeUnderstanding, summarizeUnderstanding, validateUnderstanding } from "./understanding.js";
import { defaultLaunch, exampleBenchmarks, simulateLaunch } from "./launch.js";
import type { RuntimeReport, LaunchReport } from "./launch.js";
import { defaultJourneys, runJourneys } from "./journeys.js";
import { readJson, revision, withLock, workspace, writeArtifact } from "./storage.js";
import { renderReport, renderReportMarkdown } from "./report.js";

const approvalSchema = z.object({ schemaVersion: z.literal(1), modelRevision: digestSchema, sourceDigest: digestSchema,
  approvedAt: z.string().datetime(), approvedBy: z.literal("local-user") }).strict();

async function exists(path: string) {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

export async function initializeProject(directory: string, description?: string) {
  return withLock(directory, async path => {
    if (await exists(join(path, "project.json"))) throw new Error("Hypothra is already initialized. Use review, edit, or refresh; existing files were preserved.");
    const inspection = await inspectProject(directory);
    const model = proposeUnderstanding(inspection, directory, description);
    const hash = revision(model);
    await writeArtifact(path, "inspection.json", inspection);
    await writeArtifact(path, "project.json", model);
    await writeArtifact(path, "launch.json", defaultLaunch(model));
    await writeArtifact(path, "benchmarks.json", exampleBenchmarks(new Date().toISOString().slice(0, 10)));
    await writeArtifact(path, "journeys.json", defaultJourneys());
    await writeArtifact(path, "review.md", summarizeUnderstanding(model, inspection, hash), true);
    // Commit marker is written last; a partial setup is never treated as ready.
    await writeArtifact(path, "state.json", { schemaVersion: 1, initialized: true });
    return { status: "review-required", workspace: path, revision: hash, model, inspection };
  });
}

async function loadDraft(directory: string) {
  const path = await workspace(directory);
  const state = await readJson<{ initialized?: boolean }>(join(path, "state.json"));
  if (state.initialized !== true) throw new Error("Project initialization is incomplete.");
  const inspection = await readJson<Inspection>(join(path, "inspection.json"));
  // A fresh scan checks that stored evidence is still authentic, not edited independently.
  const current = await inspectProject(directory);
  if (revision(current) !== revision(inspection)) throw new Error("Project source or scan evidence changed. Run hypothra refresh, review the new draft, and approve again.");
  const model = validateUnderstanding(await readJson(join(path, "project.json"), projectModelSchema), inspection);
  return { path, inspection, model, hash: revision(model) };
}

export async function reviewProject(directory: string) {
  return withLock(directory, async () => {
    const draft = await loadDraft(directory);
    const markdown = summarizeUnderstanding(draft.model, draft.inspection, draft.hash);
    await writeArtifact(draft.path, "review.md", markdown, true);
    let approved = false;
    try { approved = (await readJson(join(draft.path, "approval.json"), approvalSchema)).modelRevision === draft.hash; }
    catch { /* No valid approval yet. */ }
    return { status: approved ? "approved" : "review-required", revision: draft.hash, model: draft.model, inspection: draft.inspection, markdown };
  });
}

export async function saveProjectDraft(directory: string, input: unknown, expectedRevision: string) {
  return withLock(directory, async () => {
    const draft = await loadDraft(directory);
    if (draft.hash !== expectedRevision) throw new Error("Draft changed since it was opened. Reload before saving.");
    const model = validateUnderstanding(input, draft.inspection);
    await writeArtifact(draft.path, "project.json", model);
    return { status: "review-required", revision: revision(model), model };
  });
}

export async function refreshProject(directory: string) {
  return withLock(directory, async path => {
    const previous = await readJson(join(path, "project.json"), projectModelSchema);
    const inspection = await inspectProject(directory);
    const model = proposeUnderstanding(inspection, directory, previous.project.description);
    model.project = previous.project;
    model.unknowns.unshift("Source was refreshed. Reapply and review capability/stack corrections; the previous model is saved in project.previous.json.");
    await writeArtifact(path, "project.previous.json", previous);
    await writeArtifact(path, "inspection.json", inspection);
    await writeArtifact(path, "project.json", model);
    await writeArtifact(path, "approval.json", { invalidated: "source-refreshed" });
    return { status: "review-required", revision: revision(model), model };
  });
}

export async function approveProject(directory: string, expectedRevision: string) {
  digestSchema.parse(expectedRevision);
  return withLock(directory, async () => {
    const draft = await loadDraft(directory);
    if (draft.hash !== expectedRevision) throw new Error("Revision does not match the current draft. Review the current model before approval.");
    if (draft.model.project.descriptionBasis === "unreviewed") throw new Error("Add a project description and mark descriptionBasis as user before approving.");
    const approval = { schemaVersion: 1 as const, modelRevision: draft.hash, sourceDigest: draft.inspection.sourceDigest,
      approvedAt: new Date().toISOString(), approvedBy: "local-user" as const };
    await writeArtifact(draft.path, "approval.json", approval);
    return { status: "approved", ...approval };
  });
}

async function loadApproved(directory: string) {
  const draft = await loadDraft(directory);
  let approval;
  try { approval = await readJson(join(draft.path, "approval.json"), approvalSchema); }
  catch { throw new Error("Review and approve the project model before running launch experiments or browser journeys."); }
  if (approval.modelRevision !== draft.hash || approval.sourceDigest !== draft.inspection.sourceDigest) throw new Error("Approval is stale. Review and approve the current model revision.");
  return draft;
}

/** Read-only context for an explicitly bound MCP host; no agent can approve a model. */
export async function readProjectContext(directory: string, requireApproval = false) {
  const draft = requireApproval ? await loadApproved(directory) : await loadDraft(directory);
  return { revision: draft.hash, model: draft.model, inspection: draft.inspection };
}

export async function runProjectJourneys(directory: string, options: { screenshots?: boolean; stepTimeoutMs?: number } = {}) {
  return withLock(directory, async () => {
    const draft = await loadApproved(directory);
    const config = await readJson(join(draft.path, "journeys.json"), journeysSchema);
    const validIds = new Set(draft.model.capabilities.map(item => item.id));
    for (const journey of config.journeys) if (journey.capabilityIds.some(id => !validIds.has(id))) throw new Error("Journey refers to an unknown product capability.");
    const report = await runJourneys(config, draft.hash, {
      ...(options.stepTimeoutMs ? { stepTimeoutMs: options.stepTimeoutMs } : {}),
      ...(options.screenshots ? { recordScreenshot: async (name: string, data: Buffer) => {
        // Fixed generated names; no user-controlled directories or overwrites through links.
        const target = join(draft.path, name);
        if (await exists(target) && (await lstat(target)).isSymbolicLink()) throw new Error("Screenshot path is a symlink.");
        const file = await open(target, "w"); try { await file.writeFile(data); } finally { await file.close(); }
      } } : {}),
    });
    await writeArtifact(draft.path, "runtime.json", report);
    return report;
  });
}

export async function runLaunch(directory: string, useRuntime = false) {
  return withLock(directory, async () => {
    const draft = await loadApproved(directory);
    const plan = await readJson(join(draft.path, "launch.json"), launchPlanSchema);
    const benchmarks = await readJson(join(draft.path, "benchmarks.json"), benchmarksSchema);
    let runtime: RuntimeReport | undefined;
    if (useRuntime) {
      runtime = await readJson(join(draft.path, "runtime.json"), runtimeReportSchema);
      const current = await readJson(join(draft.path, "journeys.json"), journeysSchema);
      if (runtime.configurationRevision !== revision(current)) throw new Error("Journey definitions changed after the browser run. Run journeys again before using the evidence.");
    }
    const report = { ...simulateLaunch(draft.model, plan, benchmarks, { asOf: new Date().toISOString().slice(0, 10), modelRevision: draft.hash, ...(runtime ? { runtime } : {}) }),
      inputsRevision: revision({ modelRevision: draft.hash, plan, benchmarks, runtime: runtime ?? null }), runtimeAttached: useRuntime };
    await writeArtifact(draft.path, "launch-report.json", report);
    await writeArtifact(draft.path, "report.md", renderReportMarkdown(report), true);
    await writeArtifact(draft.path, "report.html", renderReport(report), true);
    return { report, markdownPath: join(draft.path, "report.md"), htmlPath: join(draft.path, "report.html") };
  });
}

export async function projectStatus(directory: string) {
  const review = await reviewProject(directory);
  const path = await workspace(directory);
  const [plan, benchmarks, journeys] = await Promise.all([
    readJson(join(path, "launch.json"), launchPlanSchema), readJson(join(path, "benchmarks.json"), benchmarksSchema), readJson(join(path, "journeys.json"), journeysSchema),
  ]);
  let report: (LaunchReport & { inputsRevision?: string; runtimeAttached?: boolean }) | null = null;
  let reportCurrent = false;
  let runtime: RuntimeReport | null = null;
  if (await exists(join(path, "runtime.json"))) runtime = await readJson(join(path, "runtime.json"), runtimeReportSchema);
  const runtimeCurrent = runtime !== null && runtime.modelRevision === review.revision && runtime.configurationRevision === revision(journeys);
  if (await exists(join(path, "launch-report.json"))) {
    report = await readJson(join(path, "launch-report.json"));
    const attached = report!.runtimeAttached ? runtime : null;
    reportCurrent = report!.inputsRevision === revision({ modelRevision: review.revision, plan, benchmarks, runtime: attached })
      && (!report!.runtimeAttached || runtimeCurrent);
  }
  return { ...review, plan, benchmarks, journeys, report, reportCurrent, runtime, runtimeCurrent };
}

export async function saveExperimentFile(directory: string, kind: "launch" | "benchmarks" | "journeys", value: unknown) {
  return withLock(directory, async path => {
    const parsed = kind === "launch" ? launchPlanSchema.parse(value) : kind === "benchmarks" ? benchmarksSchema.parse(value) : journeysSchema.parse(value);
    await writeArtifact(path, `${kind}.json`, parsed);
    return { status: "saved", kind };
  });
}
