import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
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
  assert.match(invoke(entry, ["--help"]), /rehearse prepare/);
  assert.match(await readFile(join(root, "node_modules", "hypothra", "docs", "AI-REHEARSAL.md"), "utf8"), /100,000/);
  const init = JSON.parse(invoke(entry, ["init", ".", "--no-ai", "--description", "Independent consumer fixture"]));
  invoke(entry, ["approve", ".", "--revision", init.revision]);
  const launched = JSON.parse(invoke(entry, ["launch", "."]));
  assert.equal(launched.report.totals[1].clicks, 1000);
  assert.equal(invoke(npmCli, ["exec", "--offline", "--", "hypothra", "--version"]).trim(), "0.2.0");
  assert.equal(JSON.parse(invoke(entry, ["rehearse", "status", "."])), null);
  const panel = spawn(process.execPath, [entry, "dashboard", ".", "--port", "0"], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const closed = new Promise(resolve => panel.once("close", resolve));
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Consumer dashboard did not start")), 20_000);
      let output = "";
      panel.stdout.on("data", chunk => { output += chunk.toString(); const match = output.match(/http:\/\/127\.0\.0\.1:\d+\r?\n/); if (match) { clearTimeout(timer); resolve(match[0].trim()); } });
      panel.once("error", error => { clearTimeout(timer); reject(error); });
      panel.once("close", () => { clearTimeout(timer); reject(new Error("Consumer dashboard exited unexpectedly")); });
    });
    const html = await (await fetch(url)).text();
    assert.match(html, /id="virtual-prepare-form"/);
    assert.match(html, /id="virtual-app-form"/);
  } finally { panel.kill(); await closed; }
  console.log(JSON.stringify({ packageInstall: "passed", consumerCli: "passed", initApproveLaunch: "passed", aiLaunchPanel: "passed", bundledDocs: "passed", workspaceDependenciesRequired: false }));
} finally {
  if (!root.startsWith(join(tmpdir(), "hypothra-consumer-"))) throw new Error("Temporary cleanup containment check failed.");
  await rm(root, { recursive: true, force: true });
}
