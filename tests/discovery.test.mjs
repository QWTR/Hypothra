import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultJourneys, initializeProject, inspectTestPage, suggestJourneys } from "@hypothra/product-lab";

test("rendered-page discovery records selectors and labels without input values", { timeout: 15_000 }, async () => {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><title>Test product</title><h1>Save your route</h1><input id="email" placeholder="Test email" value="private-value-sentinel"><input type="hidden" value="hidden-secret-sentinel"><button id="signup">Create account</button><p id="status" role="status">Waiting</p>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const inventory = await inspectTestPage(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(inventory.title, "Test product");
    assert.ok(inventory.elements.some(item => item.selector === "#signup" && item.label === "Create account"));
    assert.ok(inventory.elements.some(item => item.selector === "#email"));
    assert.doesNotMatch(JSON.stringify(inventory), /private-value-sentinel|hidden-secret-sentinel/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("AI journey planning requires consent and rejects invented selectors without executing a browser", async () => {
  const root = await mkdtemp(join(tmpdir(), "hypothra-planner-"));
  try {
    await writeFile(join(root, "package.json"), "{}");
    const init = await initializeProject(root, "Synthetic route product");
    const inventory = { schemaVersion: 1, baseUrl: "http://127.0.0.1:4179/", title: "Test", elements: [{ selector: "h1", tag: "h1", type: "", label: "Save a route", href: null }], limitations: [] };
    const proposal = defaultJourneys();
    const fetcher = async () => Response.json({ choices: [{ message: { content: JSON.stringify(proposal) } }] });
    const config = { endpoint: "http://127.0.0.1:11434/v1/chat/completions", model: "mock", fetcher };
    await assert.rejects(suggestJourneys(init.model, inventory, { ...config, allowUpload: false }), /allow-upload/);
    const generated = await suggestJourneys(init.model, inventory, { ...config, allowUpload: true });
    assert.equal(generated.journeys[0].id, "first-visit");
    proposal.journeys[0].steps[1].selector = "#invented";
    await assert.rejects(suggestJourneys(init.model, inventory, { ...config, allowUpload: true }), /selector/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
