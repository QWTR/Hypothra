import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { startDashboard } from "@hypothra/product-lab";

test("standalone Hypothra selects and initializes separate project folders from the panel", { timeout: 30_000 }, async () => {
  const area = await mkdtemp(join(tmpdir(), "hypothra-folder-selection-"));
  const first = join(area, "First app"), second = join(area, "Second app");
  await mkdir(first); await mkdir(second);
  await writeFile(join(first, "package.json"), '{"name":"first-app","dependencies":{"react":"^19"}}');
  await writeFile(join(second, "package.json"), '{"name":"second-app","dependencies":{"express":"^5"}}');
  let picked = 0;
  const dashboard = await startDashboard(undefined, 0, { folderPicker: async () => { picked++; return first; } });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(dashboard.url);
    await page.locator("#folder-current").filter({ hasText: "No project selected" }).waitFor();
    assert.equal(await page.locator(".steps").isVisible(), false);
    await page.getByRole("button", { name: "Browse folders…", exact: true }).click();
    await page.locator("#folder-current").filter({ hasText: first }).waitFor();
    assert.equal(picked, 1);
    assert.equal(await page.locator(".steps").isVisible(), true);
    assert.match(await readFile(join(first, ".hypothra", "inspection.json"), "utf8"), /React/);
    assert.equal(await page.getByLabel("Product name", { exact: true }).inputValue(), "First app");
    await page.getByLabel("Project folder", { exact: true }).fill(second);
    await page.getByRole("button", { name: "Open & analyze project", exact: true }).click();
    await page.locator("#folder-current").filter({ hasText: second }).waitFor();
    assert.match(await readFile(join(second, ".hypothra", "inspection.json"), "utf8"), /Express/);
    assert.equal(await page.getByLabel("Product name", { exact: true }).inputValue(), "Second app");
    // Both apps stay where they were; Hypothra's source installation is elsewhere.
    assert.equal(JSON.parse(await readFile(join(first, "package.json"), "utf8")).name, "first-app");
    assert.equal(JSON.parse(await readFile(join(second, "package.json"), "utf8")).name, "second-app");
    assert.notEqual(resolve(first), resolve(process.cwd()));
    const html = await (await fetch(dashboard.url)).text(), token = html.match(/const token="([a-f0-9]+)"/)[1];
    const stale = await fetch(dashboard.url + "/api/experiment", { method: "POST", headers: { "Content-Type": "application/json", "X-Hypothra-Token": token, "X-Hypothra-Project": first }, body: JSON.stringify({ kind: "benchmarks", value: [] }) });
    assert.equal(stale.status, 409);
  } finally { await browser.close(); await new Promise(resolve => dashboard.server.close(resolve)); await rm(area, { recursive: true, force: true }); }
});
