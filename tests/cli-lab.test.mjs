import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startDemoApp } from "../examples/demo-product/server.mjs";

const cli = resolve("packages/cli/dist/index.js");
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [cli, ...args], { windowsHide: true });
  let stdout = "", stderr = "";
  const timer = setTimeout(() => { child.kill(); reject(new Error("CLI integration timed out")); }, 15_000);
  child.stdout.on("data", chunk => { stdout += chunk.toString(); });
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  child.once("error", reject);
  child.once("close", status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
});

test("full CLI workflow: init, review, approve, real journeys, launch, and usable report", { timeout: 60_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "hypothra full workflow "));
  const product = await startDemoApp(0);
  try {
    await cp(resolve("examples/demo-product"), root, { recursive: true });
    const initialized = await run(["init", root, "--description", "A synthetic route-planning product"]);
    assert.equal(initialized.status, 0, initialized.stderr);
    const initial = JSON.parse(initialized.stdout);
    assert.equal((await run(["launch", root])).status, 1);
    const review = await run(["review", root]);
    assert.equal(review.status, 0, review.stderr);
    assert.match(review.stdout, /POST \/api\/signup/);
    const approval = await run(["approve", root, "--revision", initial.revision]);
    assert.equal(approval.status, 0, approval.stderr);
    const journeys = JSON.parse(await readFile(resolve("examples/demo-journeys.json"), "utf8"));
    journeys.baseUrl = product.url;
    await writeFile(join(root, ".hypothra", "journeys.json"), JSON.stringify(journeys));
    const plan = JSON.parse(await readFile(join(root, ".hypothra", "launch.json"), "utf8"));
    plan.channels[0].journeyId = "mobile-signup";
    await writeFile(join(root, ".hypothra", "launch.json"), JSON.stringify(plan));
    const browser = await run(["journeys", root]);
    assert.equal(browser.status, 0, browser.stderr);
    assert.deepEqual(JSON.parse(browser.stdout).findings.map(item => item.status), ["passed", "failed", "passed"]);
    const launched = await run(["launch", root, "--with-runtime"]);
    assert.equal(launched.status, 0, launched.stderr);
    const result = JSON.parse(launched.stdout);
    assert.equal(result.report.channels[0].variants[1].conditionalOnTestedFailure.blockedAt, "signup");
    assert.match(await readFile(result.htmlPath, "utf8"), /From ad promise/);
    assert.match(await readFile(result.markdownPath, "utf8"), /Observed evidence/);
    journeys.journeys[0].goal = "A modified goal invalidates old evidence";
    await writeFile(join(root, ".hypothra", "journeys.json"), JSON.stringify(journeys));
    const stale = await run(["launch", root, "--with-runtime"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /Journey definitions changed/);
  } finally { await new Promise(resolve => product.server.close(resolve)); await rm(root, { recursive: true, force: true }); }
});
