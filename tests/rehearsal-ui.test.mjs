import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { initializeProject, approveProject, startDashboard, readRehearsal, waitForRehearsal } from '@hypothra/product-lab';
import { fakeInference, prices } from './rehearsal-fixture.mjs';

test('the primary panel prepares costs with AI, preserves owner corrections, runs individual decisions and shows recommendations', { timeout: 40_000 }, async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hypothra-ai-launch-ui-')));
  const deps = fakeInference(); let dashboard, browser;
  try {
    await writeFile(join(root, 'package.json'), '{}');
    const initialized = await initializeProject(root, 'A synthetic driving route product');
    await approveProject(root, initialized.revision);
    dashboard = await startDashboard(root, 0, { autoAI: false, rehearsal: { infer: deps.infer, prices } });
    browser = await chromium.launch(); const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(dashboard.url);
    await page.locator('#status').filter({ hasText: 'Start by checking' }).waitFor();
    await page.locator('.step[data-step="1"]').click();
    assert.equal(await page.locator('#launch-form').isVisible(), false);
    await page.getByLabel('Reel script, ad concept or optional launch idea').fill('Show a saved route in the opening second.');
    await page.getByRole('button', { name: 'Build my launch plan', exact: true }).click();
    await page.locator('#virtual-plan-preview').getByRole('heading', { name: 'Route product launch' }).waitFor({ timeout: 15_000 });
    assert.equal(await page.getByLabel('AI proposed launch budget').isVisible(), false);
    await page.locator('#virtual-plan-editor > summary').click();
    await page.getByLabel('AI proposed launch budget').waitFor({ timeout: 15_000 });
    assert.equal(await page.getByLabel('AI proposed launch budget').inputValue(), '1500');
    await page.getByLabel('AI proposed launch budget').fill('2200');
    assert.equal(await page.locator('#virtual-start').isDisabled(), true);
    await page.getByRole('button', { name: 'Save plan corrections', exact: true }).click();
    await page.locator('#virtual-message').filter({ hasText: 'corrections saved' }).waitFor();
    assert.equal((await readRehearsal(root)).plan.proposedBudget, 2200);
    await page.getByRole('button', { name: 'Start 20-person pilot', exact: true }).click();
    await page.locator('#virtual-run-status[data-status="completed"]').waitFor({ timeout: 15_000 }).catch(async error => {
      const saved = await readRehearsal(root);
      console.log(JSON.stringify({ savedStatus: saved.status, savedMessage: saved.message, evaluated: saved.audience.evaluated, message: await page.locator('#virtual-message').textContent(), status: await page.locator('#virtual-run-status').textContent(), errors }));
      throw error;
    });
    assert.equal((await readRehearsal(root)).audience.evaluated, 20);
    await page.locator('#virtual-decisions > summary').click();
    await page.getByRole('button', { name: 'Show individual reactions', exact: true }).click();
    await page.locator('#virtual-records').getByText(/v000001/).waitFor();
    assert.equal(await page.locator('#virtual-records .subcard').count(), 10);
    await page.locator('.step[data-step="3"]').click();
    await page.locator('#virtual-optimization').getByText('Show a saved route in the hook', { exact: false }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const index of [0, 1, 2, 3]) {
      await page.locator(`.step[data-step="${index}"]`).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `AI launch step ${index} overflows mobile width`);
    }
    assert.deepEqual(errors, []);
    const blocked = await page.request.post(dashboard.url + '/api/rehearsal/prepare', { data: { input: {} } });
    assert.equal(blocked.status(), 403);
  } finally {
    await waitForRehearsal(root).catch(() => {}); await browser?.close();
    if (dashboard) await new Promise(resolve => dashboard.server.close(resolve));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
