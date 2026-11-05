import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { exampleScenario, simulateGrowth } from "@hypothra/simulation-core";

const cli = resolve("packages/cli/dist/index.js");
const run = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", timeout: 10_000 });

test("CLI default simulation matches the engine", () => {
  const result = run(["simulate"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), simulateGrowth(exampleScenario));
  assert.equal(result.stderr, "");
});

test("npm workspace command works offline without a published package", () => {
  assert.ok(process.env.npm_execpath, "Run tests through npm test.");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "exec", "--offline", "--", "hypothra", "--version"], {
    encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "0.1.0");
});

test("CLI init/config works in a directory with spaces and refuses overwrite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hypothra cli "));
  try {
    assert.equal(run(["init"], dir).status, 0);
    const config = join(dir, "hypothra.scenario.json");
    const before = await readFile(config, "utf8");
    assert.equal(run(["init"], dir).status, 1);
    assert.equal(await readFile(config, "utf8"), before);
    const result = run(["simulate", "--config", config], dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), simulateGrowth(exampleScenario));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("CLI rejects malformed, oversized, missing, and invalid scenario files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hypothra-input-"));
  try {
    const path = join(dir, "scenario.json");
    for (const text of ["{broken", " ".repeat(65_537), JSON.stringify({ ...exampleScenario, months: 0 })]) {
      await writeFile(path, text);
      const result = run(["simulate", "--config", path]);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /Hypothra:/);
    }
    assert.equal(run(["simulate", "--config", join(dir, "absent.json")]).status, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("CLI help and version are available", () => {
  assert.match(run(["--help"]).stdout, /package\.json \(scanner scaffold\)/);
  assert.equal(run(["--version"]).stdout.trim(), "0.1.0");
});

for (const args of [["unknown"], ["simulate", "--config"], ["simulate", "--oops"], ["analyze"], ["init", "extra"]]) {
  test(`CLI rejects arguments: ${args.join(" ")}`, () => {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  });
}

test("CLI analyze exercises manifest-only scanner", () => {
  const result = run(["analyze", resolve("packages/cli")]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "manifest-only-scaffold");
});
