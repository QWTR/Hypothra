import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = await mkdtemp(join(tmpdir(), "hypothra-consumer-"));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run through npm run package:verify.");
const invoke = (program, args) => {
  const result = spawnSync(process.execPath, [program, ...args], { cwd: root, encoding: "utf8", timeout: 60_000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
};
try {
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "hypothra-consumer-fixture", version: "1.0.0", private: true }));
  invoke(npmCli, ["install", "--save-dev", "--ignore-scripts", "--no-audit", "--no-fund", join(repo, "work", "releases", "hypothra-0.2.0.tgz")]);
  const entry = join(root, "node_modules", "hypothra", "dist", "cli.mjs");
  assert.equal(invoke(entry, ["--version"]).trim(), "0.2.0");
  const init = JSON.parse(invoke(entry, ["init", ".", "--description", "Independent consumer fixture"]));
  invoke(entry, ["approve", ".", "--revision", init.revision]);
  const launched = JSON.parse(invoke(entry, ["launch", "."]));
  assert.equal(launched.report.totals[1].clicks, 1000);
  assert.equal(invoke(npmCli, ["exec", "--offline", "--", "hypothra", "--version"]).trim(), "0.2.0");
  console.log(JSON.stringify({ packageInstall: "passed", consumerCli: "passed", initApproveLaunch: "passed", workspaceDependenciesRequired: false }));
} finally {
  if (!root.startsWith(join(tmpdir(), "hypothra-consumer-"))) throw new Error("Temporary cleanup containment check failed.");
  await rm(root, { recursive: true, force: true });
}
