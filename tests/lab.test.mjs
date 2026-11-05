import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "@hypothra/project-scanner";
import { approveProject, defaultLaunch, exampleBenchmarks, initializeProject, projectStatus, readJson, refreshProject, reviewProject,
  runLaunch, saveExperimentFile, saveProjectDraft, simulateLaunch, validateUnderstanding, revision, renderReport, enrichUnderstanding,
  startDashboard } from "@hypothra/product-lab";

const asOf = "2026-11-05";
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), "hypothra lab "));
  try {
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { express: "^5", react: "^19", "@prisma/client": "^6" } }));
    await writeFile(join(root, "server.ts"), 'import express from "express"; const app=express(); app.get("/routes",()=>{}); app.post("/signup",()=>{}); // app.get("/fake-comment",()=>{})\n');
    await writeFile(join(root, "HomeScreen.tsx"), "export function HomeScreen(){return <h1>Route planner</h1>}");
    await writeFile(join(root, "schema.prisma"), 'datasource db { provider = "postgresql" }\nmodel Route { id Int @id }');
    await fn(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function approved(root) {
  const init = await initializeProject(root, "A route planner for drivers");
  await approveProject(root, init.revision);
  return init;
}

test("scanner uses source evidence, AST routes, components, and database declarations", () => fixture(async root => {
  const scan = await inspectProject(root);
  assert.ok(scan.technologies.some(item => item.name === "React"));
  assert.ok(scan.technologies.some(item => item.name === "postgresql"));
  assert.deepEqual(scan.evidence.filter(item => item.kind === "route").map(item => item.title), ["GET /routes", "POST /signup"]);
  assert.ok(scan.evidence.some(item => item.title === "Screen component: HomeScreen"));
  assert.ok(scan.evidence.some(item => item.title === "Prisma model: Route"));
  assert.ok(scan.evidence.every(item => item.line >= 1 && !item.path.includes("..")));
  assert.deepEqual(await inspectProject(root), scan);
}));

test("scanner excludes secrets, ignored files, binaries, dependencies, and oversized sources", () => fixture(async root => {
  await writeFile(join(root, ".env"), "TOKEN=never-upload-this");
  await writeFile(join(root, "credentials.ts"), 'app.get("/secret-endpoint",()=>{})');
  await writeFile(join(root, ".gitignore"), "ignored/\n");
  await writeFile(join(root, ".hypothraignore"), "private-feature.ts\n");
  await mkdir(join(root, "ignored"));
  await writeFile(join(root, "ignored", "hidden.ts"), 'app.get("/ignored",()=>{})');
  await writeFile(join(root, "private-feature.ts"), 'app.get("/private",()=>{})');
  await writeFile(join(root, "binary.ts"), Buffer.from([0, 1, 2, 0]));
  await writeFile(join(root, "oversized.ts"), "x".repeat(131_073));
  const result = await inspectProject(root);
  assert.doesNotMatch(JSON.stringify(result), /never-upload-this|secret-endpoint|GET \/ignored|GET \/private/);
  assert.equal(result.truncated, true);
}));

test("scanner does not follow directory junctions outside the root", () => fixture(async root => {
  const outside = await mkdtemp(join(tmpdir(), "hypothra-outside-"));
  try {
    await writeFile(join(outside, "outside.ts"), 'app.get("/escaped-root",()=>{})');
    await symlink(outside, join(root, "external"), "junction");
    assert.doesNotMatch(JSON.stringify(await inspectProject(root)), /escaped-root/);
  } finally { await rm(join(root, "external"), { force: true }); await rm(outside, { recursive: true, force: true }); }
}));

test("workflow gates launch on review and exact-revision approval, then detects model edits", () => fixture(async root => {
  const init = await initializeProject(root, "Route planning for drivers");
  await assert.rejects(runLaunch(root), /approve/i);
  await assert.rejects(approveProject(root, "0".repeat(64)), /Revision/);
  await approveProject(root, init.revision);
  const first = await runLaunch(root);
  assert.equal(first.report.totals.length, 3);
  assert.equal((await projectStatus(root)).reportCurrent, true);
  const draft = structuredClone(init.model);
  draft.project.description = "A corrected description";
  await saveProjectDraft(root, draft, init.revision);
  await assert.rejects(runLaunch(root), /stale/);
  assert.equal((await projectStatus(root)).reportCurrent, false);
  await assert.rejects(saveProjectDraft(root, draft, init.revision), /changed/);
}));

test("source edits invalidate approval; refresh preserves a previous model", () => fixture(async root => {
  await approved(root);
  await writeFile(join(root, "new-screen.ts"), 'app.get("/new",()=>{})');
  await assert.rejects(runLaunch(root), /source.*changed/i);
  await refreshProject(root);
  assert.ok(await readFile(join(root, ".hypothra", "project.previous.json"), "utf8"));
  await assert.rejects(runLaunch(root), /approve/i);
}));

test("stored evidence tampering and nonexistent claim evidence are rejected", () => fixture(async root => {
  const init = await initializeProject(root, "Route product");
  const invalid = structuredClone(init.model);
  invalid.stack[0].evidenceIds = ["invented"];
  assert.throws(() => validateUnderstanding(invalid, init.inspection), /nonexistent/);
  const stored = await readJson(join(root, ".hypothra", "inspection.json"));
  stored.evidence[0].title = "Altered evidence";
  await writeFile(join(root, ".hypothra", "inspection.json"), JSON.stringify(stored));
  await assert.rejects(reviewProject(root), /evidence changed/);
}));

test("manual observed claims require evidence, while user-confirmed capabilities can be added", () => fixture(async root => {
  const init = await initializeProject(root, "Route product");
  const draft = structuredClone(init.model);
  draft.capabilities.push({ id: "manual", title: "Manual correction", description: "The owner confirmed this", status: "observed", evidenceIds: [] });
  assert.throws(() => validateUnderstanding(draft, init.inspection), /evidence/);
  draft.capabilities.at(-1).status = "user-confirmed";
  assert.ok(validateUnderstanding(draft, init.inspection));
}));

test("launch funnel matches an independent calculation and orders variants", () => fixture(async root => {
  const init = await approved(root);
  const plan = defaultLaunch(init.model), benchmarks = exampleBenchmarks(asOf);
  const report = simulateLaunch(init.model, plan, benchmarks, { asOf, modelRevision: init.revision });
  const central = report.totals[1];
  // 2000 / 20 * 1000 = 100000 impressions; 1% CTR; 5% signup; 50% activate; 5% pay.
  assert.equal(central.clicks, 1000);
  assert.equal(central.signups, 50);
  assert.equal(central.activated, 25);
  assert.equal(central.paying, 1.25);
  assert.equal(central.firstMonthRevenue, 23.75);
  assert.equal(central.costs, 2512.5);
  assert.equal(central.firstMonthProfit, -2488.75);
  assert.ok(report.totals[0].signups < central.signups && report.totals[2].signups > central.signups);
  assert.ok(report.warnings.some(item => item.includes("synthetic")));
  assert.deepEqual(simulateLaunch(init.model, plan, benchmarks, { asOf, modelRevision: init.revision }), report);
}));

test("launch rejects over-budget, mismatched, stale, future, and unsupported evidence", () => fixture(async root => {
  const init = await approved(root);
  const plan = defaultLaunch(init.model), prices = exampleBenchmarks(asOf);
  const run = (p = plan, b = prices) => simulateLaunch(init.model, p, b, { asOf, modelRevision: init.revision });
  assert.throws(() => run({ ...plan, totalBudget: 100 }), /budget/);
  assert.throws(() => run({ ...plan, currency: "USD" }), /match/);
  assert.throws(() => run(plan, []), /Missing benchmark/);
  const bad = structuredClone(prices);
  bad[1].source.type = "public-benchmark";
  bad[1].source.url = "https://example.com/prices";
  bad[1].source.observedFrom = "2026-01-01";
  bad[1].source.observedTo = "2026-01-02";
  assert.throws(() => run(plan, bad), /stale/);
  bad[1].source.collectedAt = "2027-01-01";
  assert.throws(() => run(plan, bad), /future/);
  const unknown = structuredClone(plan); unknown.channels[0].creative.capabilityIds = ["invented"];
  assert.throws(() => run(unknown), /unknown capability/);
}));

test("a reproduced signup bug produces a labeled conditional impact, not a fake conversion measurement", () => fixture(async root => {
  const init = await approved(root), plan = defaultLaunch(init.model);
  plan.channels[0].journeyId = "mobile";
  const runtime = { schemaVersion: 1, modelRevision: init.revision, configurationRevision: "a".repeat(64), baseUrl: "http://127.0.0.1:1234", recordedAt: "2026-11-05T12:00:00Z", requestCount: 1, blockedRequests: 0, limitations: [], findings: [{ journeyId: "mobile", status: "failed", failedStage: "signup", completedStages: ["landing"],
    persona: "Synthetic mobile visitor", evidence: ["Signup assertion failed"], hypothesis: "Visitor might leave" }] };
  const report = simulateLaunch(init.model, plan, exampleBenchmarks(asOf), { asOf, modelRevision: init.revision, runtime });
  assert.equal(report.channels[0].variants[1].projected.signups, 50);
  assert.equal(report.channels[0].variants[1].conditionalOnTestedFailure.signups, 0);
  assert.match(report.channels[0].variants[1].conditionalOnTestedFailure.assumption, /not a measured conversion/);
  assert.throws(() => simulateLaunch(init.model, plan, exampleBenchmarks(asOf), { asOf, modelRevision: "different", runtime }), /different approved model/);
}));

test("report HTML escapes untrusted application and creative text", () => fixture(async root => {
  const init = await approved(root), plan = defaultLaunch(init.model);
  plan.channels[0].creative.message = '<script>alert("bad")</script>';
  const html = renderReport(simulateLaunch(init.model, plan, exampleBenchmarks(asOf), { asOf, modelRevision: init.revision }));
  assert.doesNotMatch(html, /<script>alert\("bad"\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
}));

test("model enrichment is opt-in, validates evidence, and keeps generated descriptions hypothetical", () => fixture(async root => {
  const init = await initializeProject(root, "Route product");
  let called = false;
  const generated = structuredClone(init.model);
  generated.analysis.engine = "model-assisted-v1";
  generated.project.description = "Model-derived product interpretation";
  generated.project.descriptionBasis = "model-hypothesis";
  const fetcher = async (_url, request) => {
    called = true; assert.equal(request.redirect, "error");
    assert.match(JSON.parse(request.body).messages[0].content, /UNTRUSTED DATA/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(generated) } }] });
  };
  const config = { endpoint: "http://127.0.0.1:11434/v1/chat/completions", model: "test", fetcher };
  await assert.rejects(enrichUnderstanding(init.model, init.inspection, { ...config, allowUpload: false }), /allow-upload/);
  assert.equal(called, false);
  assert.equal((await enrichUnderstanding(init.model, init.inspection, { ...config, allowUpload: true })).project.descriptionBasis, "model-hypothesis");
  generated.stack[0].evidenceIds = ["made-up"];
  await assert.rejects(enrichUnderstanding(init.model, init.inspection, { ...config, allowUpload: true }), /contract/);
}));

test("dashboard protects mutations, rejects outside origins, saves and invalidates stale reports", () => fixture(async root => {
  await approved(root);
  const dashboard = await startDashboard(root, 0);
  try {
    const response = await fetch(dashboard.url);
    const html = await response.text();
    assert.equal(response.status, 200);
    const token = html.match(/const token="([a-f0-9]+)"/)[1];
    const post = (path, data, headers = {}) => fetch(dashboard.url + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Hypothra-Token": token, ...headers }, body: JSON.stringify(data) });
    assert.equal((await post("/api/launch", { useRuntime: false }, { "X-Hypothra-Token": "invalid" })).status, 403);
    assert.equal((await post("/api/launch", { useRuntime: false }, { Origin: "https://evil.invalid" })).status, 403);
    assert.equal((await post("/api/launch", { useRuntime: false })).status, 200);
    assert.equal((await fetch(dashboard.url + "/report")).status, 200);
    const state = await (await fetch(dashboard.url + "/api/state")).json();
    state.plan.monthlyPrice = 25;
    assert.equal((await post("/api/experiment", { kind: "launch", value: state.plan })).status, 200);
    assert.equal((await fetch(dashboard.url + "/report")).status, 409);
    assert.equal((await (await fetch(dashboard.url + "/api/state")).json()).reportCurrent, false);
  } finally { await new Promise(resolve => dashboard.server.close(resolve)); }
}));

test("revision hash is independent of object key order", () => {
  assert.equal(revision({ a: 1, b: { y: 2, x: 3 } }), revision({ b: { x: 3, y: 2 }, a: 1 }));
});
