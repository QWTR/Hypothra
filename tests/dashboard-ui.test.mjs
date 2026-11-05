import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { approveProject, exampleBenchmarks, initializeProject, projectStatus, readJson, saveExperimentFile, startDashboard } from "@hypothra/product-lab";
import { startDemoApp } from "../examples/demo-product/server.mjs";

test("friendly panel completes product correction, public price selection, app checks, and results without JSON", { timeout: 90_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "hypothra-friendly-ui-"));
  const product = await startDemoApp(0);
  let dashboard, browser;
  try {
    await cp(resolve("examples/demo-product"), root, { recursive: true });
    const init = await initializeProject(root, "A synthetic route-planning product");
    await approveProject(root, init.revision);
    const journeys = await readJson(resolve("examples/demo-journeys.json")); journeys.baseUrl = product.url;
    await saveExperimentFile(root, "journeys", journeys);
    dashboard = await startDashboard(root, 0);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    const source = exampleBenchmarks(new Date().toISOString().slice(0, 10))[1];
    source.id = "published-tiktok"; source.country = "ZZ"; source.objective = "mixed"; source.source.type = "public-benchmark";
    source.source.label = "Synthetic response standing in for a published benchmark"; source.source.url = "https://adkit.so/benchmarks?platform=tiktok";
    await page.route("**/api/public-prices", route => route.fulfill({ json: { benchmarks: [source], checkedAt: source.source.collectedAt, sources: [source.source.url], notes: [] } }));
    await page.goto(dashboard.url);
    await page.locator("#status").filter({ hasText: "Start by checking" }).waitFor();
    for (const editor of await page.locator("textarea.json").all()) assert.equal(await editor.isVisible(), false);
    await page.getByLabel("What does it do?").fill("Corrected: drivers can save their favorite routes.");
    assert.equal(await page.locator("#approve").isDisabled(), true);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.locator("#status").filter({ hasText: "Product updated" }).waitFor();
    assert.equal((await projectStatus(root)).model.project.description, "Corrected: drivers can save their favorite routes.");
    await page.locator("#approve").click();
    await page.locator("#status").filter({ hasText: "Product confirmed" }).waitFor();
    await page.locator("#manual-launch > summary").click();
    await page.getByLabel("Total budget", { exact: true }).fill("3500");
    await page.getByLabel("Which app check matches this ad?").selectOption("mobile-signup");
    await page.getByRole("button", { name: "Find published prices", exact: true }).click();
    await page.locator("#status").filter({ hasText: "Published prices found" }).waitFor();
    await page.getByRole("button", { name: "Use this cost estimate", exact: true }).click();
    await page.locator("#status").filter({ hasText: "Cost estimate selected" }).waitFor();
    // Looking up and choosing prices must not discard the unsaved budget.
    assert.equal(await page.getByLabel("Total budget", { exact: true }).inputValue(), "3500");
    await page.getByRole("button", { name: "Save launch plan", exact: true }).click();
    await page.locator("#status").filter({ hasText: "Launch plan saved" }).waitFor();
    const saved = await projectStatus(root);
    assert.equal(saved.plan.totalBudget, 3500); assert.equal(saved.plan.channels[0].benchmarkId, "published-tiktok");
    await page.getByRole("button", { name: "Continue to app checks", exact: true }).click();
    await page.locator("#scripted-checks > summary").click();
    await page.getByRole("button", { name: "Run app checks", exact: true }).click();
    await page.locator("#status").filter({ hasText: "App checks finished" }).waitFor({ timeout: 30_000 });
    assert.equal(await page.locator("#journey-list").getByText("Needs attention", { exact: true }).count(), 1);
    await page.getByRole("button", { name: "Continue to results", exact: true }).click();
    await page.locator("#manual-results > summary").click();
    await page.getByRole("button", { name: "Calculate launch scenario", exact: true }).click();
    await page.locator("#status").filter({ hasText: "Your launch scenario is ready" }).waitFor();
    assert.equal(await page.locator("#result-cards .card").count(), 4);
    assert.match(await page.locator("#findings-summary").innerText(), /App checks found a problem/);
    assert.equal(await page.locator("#report-link").isVisible(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const index of [0, 1, 2, 3]) {
      await page.locator(`.step[data-step="${index}"]`).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Step ${index} overflows mobile width`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (dashboard) await new Promise(resolve => dashboard.server.close(resolve));
    await new Promise(resolve => product.server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
