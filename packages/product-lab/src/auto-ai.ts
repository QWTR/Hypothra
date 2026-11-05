import { join } from "node:path";
import { realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { inspectProject } from "@hypothra/project-scanner";
import type { Inspection } from "@hypothra/project-scanner";
import { aiJobSchema, journeysSchema, launchPlanSchema } from "./schema.js";
import type { AIJob, ProjectModel } from "./schema.js";
import { readJson, revision, withLock, workspace, writeArtifact } from "./storage.js";
import { defaultLaunch } from "./launch.js";
import { readProjectContext, saveProjectDraft } from "./workflow.js";
import { analyzeWithCodex, codexAvailability } from "./codex-ai.js";
import { enrichUnderstanding } from "./ai.js";

const active = new Map<string, Promise<AIJob>>();
type Options = { force?: boolean; generate?: (model: ProjectModel, inspection: Inspection) => Promise<ProjectModel> };

async function retryBusy<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await task(); }
    catch (error) {
      if (attempt >= 50 || !(error instanceof Error) || !error.message.startsWith("Another Hypothra operation")) throw error;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
}

export async function readAIStatus(directory: string): Promise<AIJob> {
  try { return await readJson(join(await workspace(directory), "ai-status.json"), aiJobSchema); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return { id: "not-started", status: "idle", message: "AI will prepare your project details automatically." }; }
}

async function store(directory: string, job: AIJob) {
  await retryBusy(() => withLock(directory, path => writeArtifact(path, "ai-status.json", job)));
  return job;
}

export async function disableAutomaticAnalysis(directory: string) {
  return store(directory, { id: randomUUID(), status: "disabled", message: "AI was skipped for this project. You can enable it later with Analyze with AI." });
}

export async function queueAutomaticAnalysis(directory: string, options: Options = {}): Promise<AIJob> {
  const root = await realpath(directory);
  if (active.has(root)) return readAIStatus(root);
  const context = await readProjectContext(root);
  const previous = await readAIStatus(root);
  if (!options.force && context.model.analysis.engine === "model-assisted-v1") {
    return previous.status === "completed" ? previous : store(root, { id: previous.id, status: "completed", message: "AI prepared these details. You can edit every project field before confirming.", modelRevision: context.revision });
  }
  if (!options.force && ["failed", "unavailable", "disabled"].includes(previous.status)) return previous;
  if (previous.status === "running" && previous.startedAt && Date.now() - Date.parse(previous.startedAt) < 160_000) return previous;
  const job: AIJob = { id: randomUUID(), status: "running", message: "AI is reading your project and preparing the details. You do not need to fill them in manually.", startedAt: new Date().toISOString(), sourceDigest: context.inspection.sourceDigest };
  if (process.env.HYPOTHRA_AI_MODE === "off" && !options.generate) return store(root, { ...job, status: "disabled", message: "Automatic AI analysis is disabled for this run. Existing information remains editable." });
  await store(root, job);
  const task = (async (): Promise<AIJob> => {
    try {
      const inspection = await inspectProject(root, { includeContext: true });
      if (inspection.sourceDigest !== context.inspection.sourceDigest) throw new Error("Project files changed. Refresh the project scan before asking AI to analyze it again.");
      let model: ProjectModel;
      let provider: string;
      if (options.generate) { provider = "test-provider"; model = await options.generate(context.model, inspection); }
      else if (process.env.HYPOTHRA_AI_ENDPOINT && process.env.HYPOTHRA_AI_MODEL) {
        provider = "configured-model";
        model = await enrichUnderstanding(context.model, inspection, { endpoint: process.env.HYPOTHRA_AI_ENDPOINT, model: process.env.HYPOTHRA_AI_MODEL, allowUpload: true });
      } else {
        const codex = codexAvailability(root);
        if (!codex.available) return await store(root, { ...job, status: "unavailable", finishedAt: new Date().toISOString(), message: "Connect an AI engine once: sign in to Codex, or configure a compatible model. Then use Analyze with AI. No project details were invented." });
        provider = "codex";
        model = await analyzeWithCodex(context.model, inspection, codex.executable);
      }
      if (context.model.project.descriptionBasis === "user") model.project = { ...model.project, description: context.model.project.description, descriptionBasis: "user" };
      const saved = await retryBusy(() => saveProjectDraft(root, model, context.revision, { backup: true }));
      await retryBusy(() => withLock(root, async path => {
        const plan = await readJson(join(path, "launch.json"), launchPlanSchema);
        const freshIds = new Set(model.capabilities.map(item => item.id));
        if (revision(plan) === revision(defaultLaunch(context.model))) await writeArtifact(path, "launch.json", defaultLaunch(model));
        else {
          for (const channel of plan.channels) channel.creative.capabilityIds = channel.creative.capabilityIds.filter(id => freshIds.has(id));
          await writeArtifact(path, "launch.json", plan);
        }
        const journeys = await readJson(join(path, "journeys.json"), journeysSchema);
        for (const journey of journeys.journeys) journey.capabilityIds = journey.capabilityIds.filter(id => freshIds.has(id));
        await writeArtifact(path, "journeys.json", journeys);
      }));
      return await store(root, { ...job, status: "completed", provider, contextFiles: inspection.context?.length ?? 0, modelRevision: saved.revision,
        finishedAt: new Date().toISOString(), message: "AI filled in the project details. Review the summary and change anything it misunderstood." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI analysis did not finish.";
      return store(root, { ...job, status: "failed", finishedAt: new Date().toISOString(), message: message.slice(0, 700) + " Your saved information was preserved." });
    } finally { active.delete(root); }
  })();
  active.set(root, task);
  void task.catch(() => { active.delete(root); });
  return job;
}

export async function fillProjectWithAI(directory: string, options: Options = {}): Promise<AIJob> {
  const root = await realpath(directory);
  const job = await queueAutomaticAnalysis(root, options);
  return active.get(root) ?? job;
}
