import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject } from "@hypothra/project-scanner";

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), "hypothra-scanner-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("scanner returns dependency names only; does not execute scripts or read secrets", () => fixture(async root => {
  await writeFile(join(root, "package.json"), JSON.stringify({
    dependencies: { zod: "^4", alpha: "^1" }, devDependencies: { typescript: "^7" },
    scripts: { postinstall: "exit 99" }, secret: "manifest-secret-sentinel",
  }));
  await writeFile(join(root, ".env"), "TOKEN=secret-sentinel");
  await mkdir(join(root, "node_modules"));
  await writeFile(join(root, "node_modules", "secret.txt"), "nested-secret-sentinel");
  const result = await scanProject(root);
  assert.deepEqual(result.dependencies, ["alpha", "zod"]);
  assert.deepEqual(result.devDependencies, ["typescript"]);
  assert.doesNotMatch(JSON.stringify(result), /secret-sentinel|postinstall/);
}));

test("scanner rejects missing, malformed, oversized, and non-object manifests", () => fixture(async root => {
  await assert.rejects(scanProject(root));
  for (const text of ["{broken", " ".repeat(65_537), "null", "[]"]) {
    await writeFile(join(root, "package.json"), text);
    await assert.rejects(scanProject(root));
  }
}));

test("scanner rejects a directory in place of package.json", () => fixture(async root => {
  await mkdir(join(root, "package.json"));
  await assert.rejects(scanProject(root), /regular file/);
}));

test("scanner rejects symlinked manifests when OS permits symlink creation", async t => fixture(async root => {
  await writeFile(join(root, "outside.json"), "{}");
  try { await symlink(join(root, "outside.json"), join(root, "package.json"), "file"); }
  catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") return t.skip("OS does not permit creating file symlinks.");
    throw error;
  }
  await assert.rejects(scanProject(root), /symlink/);
}));
