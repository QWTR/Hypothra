import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { approveProject, defaultLaunch, exampleBenchmarks, initializeProject, runLaunch } from "@hypothra/product-lab";

test("bound MCP host reads evidence and proposes corrections but cannot approve or access arbitrary paths", { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "hypothra-mcp-lab-"));
  const client = new Client({ name: "lab-integration", version: "0.2.0" });
  try {
    await writeFile(join(root, "package.json"), '{"dependencies":{"react":"^19"}}');
    const init = await initializeProject(root, "A synthetic route planner");
    const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("packages/mcp-server/dist/index.js")],
      env: { ...getDefaultEnvironment(), HYPOTHRA_PROJECT_ROOT: root }, stderr: "pipe" });
    await client.connect(transport);
    const names = (await client.listTools()).tools.map(tool => tool.name);
    assert.deepEqual(names, ["simulate_growth", "research_ad_costs", "get_project_understanding", "propose_project_understanding", "simulate_product_launch"]);
    assert.ok(!names.some(name => /approve|shell|browser|ads/.test(name)));
    const context = await client.callTool({ name: "get_project_understanding", arguments: {} });
    assert.equal(context.structuredContent.revision, init.revision);
    const rejected = await client.callTool({ name: "get_project_understanding", arguments: { path: "C:/private" } });
    assert.equal(rejected.isError, true);
    const plan = defaultLaunch(init.model), benchmarks = exampleBenchmarks(new Date().toISOString().slice(0, 10));
    assert.equal((await client.callTool({ name: "simulate_product_launch", arguments: { plan, benchmarks } })).isError, true);
    await approveProject(root, init.revision);
    const simulation = await client.callTool({ name: "simulate_product_launch", arguments: { plan, benchmarks } });
    assert.ok(!simulation.isError);
    assert.equal(simulation.structuredContent.totals[1].clicks, 1000);
    const model = structuredClone(init.model);
    model.project.description = "Owner correction drafted by the host";
    const proposed = await client.callTool({ name: "propose_project_understanding", arguments: { expectedRevision: init.revision, model } });
    assert.equal(proposed.structuredContent.status, "review-required");
    await assert.rejects(runLaunch(root), /stale/);
  } finally { await client.close(); await rm(root, { recursive: true, force: true }); }
});
