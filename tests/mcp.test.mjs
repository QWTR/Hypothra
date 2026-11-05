import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { exampleScenario, simulateGrowth } from "@hypothra/simulation-core";

test("MCP stdio: initialize, discover, invoke, repeat, reject invalid calls, close", { timeout: 20_000 }, async () => {
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [resolve("packages/mcp-server/dist/index.js")], stderr: "pipe" });
  const client = new Client({ name: "hypothra-integration-test", version: "0.1.0" });
  let errors = "";
  transport.stderr?.on("data", chunk => { errors += chunk.toString(); });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ["simulate_growth"]);
    const invoke = input => client.callTool({ name: "simulate_growth", arguments: input });
    const first = await invoke({ ...exampleScenario });
    assert.ok(!first.isError);
    assert.deepEqual(JSON.parse(first.content[0].text), simulateGrowth(exampleScenario));
    assert.deepEqual(first.structuredContent, simulateGrowth(exampleScenario));
    assert.deepEqual(await invoke({ ...exampleScenario }), first);
    for (const args of [{ ...exampleScenario, months: 121 }, { ...exampleScenario, acquisitionCost: 0 },
      { ...exampleScenario, filePath: "C:/private/.env" }, {}]) {
      try { assert.equal((await invoke(args)).isError, true); }
      catch (error) { assert.match(error.message, /invalid|validation|required|argument|schema/i); }
    }
    await assert.rejects(client.callTool({ name: "analyze_project", arguments: {} }));
    assert.equal(errors, "");
  } finally { await client.close(); }
});
