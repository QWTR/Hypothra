import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analysisPayload, analyzeWithCodex, cleanupAnalysisDirectory, proposeUnderstanding } from "@hypothra/product-lab";

function largeProject() {
  const evidence = Array.from({ length: 700 }, (_, index) => ({ id: `e-${index}`, kind: "route",
    title: `Route ${index} ${"feature ".repeat(20)}`, path: `src/${"section/".repeat(10)}route-${index}.ts`, line: 1 }));
  const inspection = { schemaVersion: 1, engine: "structural-v1", sourceDigest: "a".repeat(64), filesScanned: 1000,
    bytesScanned: 8_000_000, truncated: true, evidence, technologies: [], warnings: ["Scan budget reached"],
    context: Array.from({ length: 28 }, (_, index) => ({ path: `src/page-${index}.ts`, text: "Readable source code. ".repeat(170), truncated: true })) };
  return { inspection, model: proposeUnderstanding(inspection, "LargeProject", "Owner's exact project description") };
}

test("large project input fits the AI budget while keeping owner text, evidence references and source excerpts", () => {
  const { model, inspection } = largeProject(), original = JSON.stringify(model);
  const payload = analysisPayload(model, inspection), data = JSON.parse(payload);
  assert.ok(Buffer.byteLength(payload) <= 240_000);
  assert.equal(data.draft.project.description, model.project.description);
  assert.ok(data.sourceExcerpts.length > 0);
  assert.ok(data.limits.omittedEvidence > 0);
  assert.ok(data.limits.omittedDraftClaims > 0);
  const evidenceIds = new Set(data.evidence.map(item => item.id));
  for (const claim of [...data.draft.stack, ...data.draft.capabilities, ...data.draft.userJourneys]) {
    assert.ok(claim.evidenceIds.every(id => evidenceIds.has(id)));
  }
  assert.equal(JSON.stringify(model), original);
});

test("oversized saved input is rejected before an analysis process is started", async () => {
  const { model, inspection } = largeProject();
  model.project.description = "x".repeat(250_000);
  await assert.rejects(analyzeWithCodex(model, inspection, "missing-analysis-executable"), /Saved project details exceed/);
});

test("temporary cleanup retries Windows locks and treats remaining filesystem errors as nonfatal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hypothra-ai-"));
  try {
    for (const code of ["EBUSY", "EPERM", "EACCES"]) {
      let calls = 0;
      assert.equal(await cleanupAnalysisDirectory(directory, async (path, options) => {
        calls++;
        assert.equal(path, directory);
        assert.deepEqual(options, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
        throw Object.assign(new Error("File is still locked"), { code });
      }), false);
      assert.equal(calls, 1);
    }
    await writeFile(join(directory, "response.json"), "{}");
    assert.equal(await cleanupAnalysisDirectory(directory), true);
    await assert.rejects(access(directory), { code: "ENOENT" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("temporary cleanup refuses paths outside a direct Hypothra analysis directory", async () => {
  let removed = false;
  for (const path of [tmpdir(), join(tmpdir(), "another-project"), join(tmpdir(), "hypothra-ai-valid", "nested")]) {
    await assert.rejects(cleanupAnalysisDirectory(path, async () => { removed = true; }), /containment/);
  }
  assert.equal(removed, false);
});
