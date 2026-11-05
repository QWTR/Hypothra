import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runJourneys, validateLocalTarget } from "@hypothra/product-lab";
import { startDemoApp } from "../examples/demo-product/server.mjs";

test("browser journeys observe working signup, broken mobile signup, and permission denial", { timeout: 30_000 }, async () => {
  const product = await startDemoApp(0);
  try {
    const config = JSON.parse(await readFile(new URL("../examples/demo-journeys.json", import.meta.url), "utf8"));
    config.baseUrl = product.url;
    const report = await runJourneys(config, "a".repeat(64), { stepTimeoutMs: 1200 });
    assert.deepEqual(report.findings.map(item => item.status), ["passed", "failed", "passed"]);
    assert.equal(report.findings[1].failedStage, "signup");
    assert.ok(report.findings[0].completedStages.includes("activation"));
    assert.match(report.findings[1].hypothesis, /hypothesis/);
    assert.ok(report.requestCount > 0 && report.requestCount < 250);
    assert.equal(report.blockedRequests, 0);
  } finally { await new Promise(resolve => product.server.close(resolve)); }
});

test("browser runner blocks redirects to external services", { timeout: 15_000 }, async () => {
  const product = await startDemoApp(0);
  try {
    const report = await runJourneys({ schemaVersion: 1, baseUrl: product.url, environment: "local-test", journeys: [{
      id: "redirect", persona: "Synthetic visitor", goal: "Verify origin containment", hypothesis: "External navigation must be blocked",
      capabilityIds: [], viewport: { width: 390, height: 844 }, denyPermissions: true,
      steps: [{ action: "navigate", path: "/redirect", stage: "landing" }],
    }] }, "a".repeat(64), { stepTimeoutMs: 1000 });
    assert.equal(report.findings[0].status, "failed");
    assert.ok(report.blockedRequests >= 1);
    assert.ok(report.findings[0].evidence.some(item => item.includes("external redirect")));
  } finally { await new Promise(resolve => product.server.close(resolve)); }
});

test("browser target guard rejects production URLs, embedded credentials, and file URLs", () => {
  for (const value of ["https://example.com/", "http://127.0.0.1/", "http://localhost:1234/", "http://127.0.0.1:1234/path", "http://user:secret@127.0.0.1:1234/", "file:///C:/private.txt"]) {
    assert.throws(() => validateLocalTarget(value));
  }
  assert.equal(validateLocalTarget("http://127.0.0.1:4179/").port, "4179");
});
