import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { inspectProject } from "@hypothra/project-scanner";
import { fillProjectWithAI, initializeProject, queueAutomaticAnalysis, readAIStatus, readProjectContext, readJson,
  reviewProject, runLaunch, saveProjectDraft, startDashboard, validateAIResult } from "@hypothra/product-lab";

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), "hypothra-auto-ai-"));
  try {
    await writeFile(join(root, "package.json"), '{"dependencies":{"react":"^19"}}');
    await writeFile(join(root, "README.md"), "# Routebook\n\nSave and organize your favorite driving routes.");
    await writeFile(join(root, "app.ts"), 'app.get("/routes",()=>{}); const secret="never-upload-this-value";');
    await initializeProject(root);
    await fn(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
// modelOutputSchema is strict and omits analysis; construct the model-facing object explicitly.
function generate(model, inspection) {
  const result = { ...model, project: { name: "Routebook", description: "Save and organize driving routes.", audience: ["Drivers planning trips"],
    valueProposition: "Keep favorite routes in one place", monetization: "No paid model is specified in the inspected source", descriptionBasis: "model-hypothesis" },
    capabilities: [{ id: "route-library", title: "Route library", description: "Organize saved routes", status: "inferred", evidenceIds: [] }],
    userJourneys: [{ id: "save-route", name: "Save a route", goal: "Keep a favorite trip", steps: ["Open the app", "Save a route"], evidenceIds: [] }] };
  delete result.analysis;
  return validateAIResult(result, model, inspection);
}

test("AI context is opt-in to the scanner, bounded, and redacts secret assignments", () => fixture(async root => {
  await writeFile(join(root, ".env"), "TOKEN=private-env-sentinel");
  const normal = await inspectProject(root), context = await inspectProject(root, { includeContext: true });
  assert.equal(normal.context, undefined);
  assert.ok(context.context.some(item => item.path === "README.md"));
  assert.doesNotMatch(JSON.stringify(context.context), /never-upload-this-value|private-env-sentinel/);
  assert.equal(context.sourceDigest, normal.sourceDigest);
}));

test("AI fills all project fields without a manual description and keeps confirmation with the user", () => fixture(async root => {
  const job = await fillProjectWithAI(root, { generate: async (model, inspection) => generate(model, inspection) });
  assert.equal(job.status, "completed");
  const context = await readProjectContext(root);
  assert.equal(context.model.project.name, "Routebook");
  assert.equal(context.model.analysis.engine, "model-assisted-v1");
  assert.equal(context.model.project.descriptionBasis, "model-hypothesis");
  assert.equal(context.model.userJourneys[0].name, "Save a route");
  assert.equal((await reviewProject(root)).status, "review-required");
  await assert.rejects(runLaunch(root), /approve/);
  assert.ok(await readJson(join(root, ".hypothra", "project.before-ai.json")));
  const plan = await readJson(join(root, ".hypothra", "launch.json"));
  assert.equal(plan.channels[0].creative.message, context.model.project.description);
  assert.deepEqual(plan.channels[0].creative.capabilityIds, ["route-library"]);
}));

test("manual corrections made while AI is running are preserved", () => fixture(async root => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await queueAutomaticAnalysis(root, { generate: async (model, inspection) => { await gate; return generate(model, inspection); } });
  const context = await readProjectContext(root);
  const model = structuredClone(context.model);
  model.project.description = "The owner corrected this while analysis was in progress";
  model.project.descriptionBasis = "user";
  await saveProjectDraft(root, model, context.revision);
  release();
  const job = await fillProjectWithAI(root);
  assert.equal(job.status, "failed");
  assert.equal((await readProjectContext(root)).model.project.description, model.project.description);
}));

test("opening an already analyzed project does not regenerate or erase owner edits", () => fixture(async root => {
  await fillProjectWithAI(root, { generate: async (model, inspection) => generate(model, inspection) });
  const context = await readProjectContext(root), model = structuredClone(context.model);
  model.project.description = "Owner's final product description"; model.project.descriptionBasis = "user";
  await saveProjectDraft(root, model, context.revision);
  let called = false;
  await fillProjectWithAI(root, { generate: async (model, inspection) => { called = true; return generate(model, inspection); } });
  assert.equal(called, false);
  assert.equal((await readProjectContext(root)).model.project.description, "Owner's final product description");
}));

test("the panel shows AI progress, automatically loads generated fields, and lets the owner edit them", { timeout: 30_000 }, () => fixture(async root => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const dashboard = await startDashboard(root, 0, { autoAI: false });
  const browser = await chromium.launch();
  try {
    await queueAutomaticAnalysis(root, { generate: async (model, inspection) => { await gate; return generate(model, inspection); } });
    const page = await browser.newPage(); await page.goto(dashboard.url);
    await page.locator("#ai-heading").filter({ hasText: "AI is understanding" }).waitFor();
    assert.equal(await page.locator("#product-form").isVisible(), false);
    release();
    await page.locator("#ai-heading").filter({ hasText: "filled by AI" }).waitFor({ timeout: 15_000 });
    assert.equal(await page.getByLabel("Product name", { exact: true }).inputValue(), "Routebook");
    await page.locator("#product-editor > summary").click();
    await page.getByLabel("What does it do?").fill("A correction to the AI's understanding");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.locator("#status").filter({ hasText: "Product updated" }).waitFor();
    assert.equal((await readProjectContext(root)).model.project.description, "A correction to the AI's understanding");
  } finally { release(); await browser.close(); await new Promise(resolve => dashboard.server.close(resolve)); }
}));
