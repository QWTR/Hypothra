import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { initializeProject, approveProject, disableAutomaticAnalysis, startDashboard, waitForRehearsal, readRehearsal, rehearsalPlanSchema, viewerBatchSchema, optimizationSchema } from '@hypothra/product-lab';
import { fakeInference, prices } from './rehearsal-fixture.mjs';

function gate() { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; }

test('the guided UI gives immediate button feedback, honest live progress, usable navigation, reduced motion and recoverable errors', { timeout: 60_000 }, async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hypothra-feedback-')));
  const request = gate(), planning = gate(), audience = gate(), insights = gate();
  const controlled = fakeInference(async schema => {
    if (schema === rehearsalPlanSchema) await planning.promise;
    if (schema === viewerBatchSchema) await audience.promise;
    if (schema === optimizationSchema) await insights.promise;
  });
  let dashboard, browser;
  try {
    await writeFile(join(root, 'package.json'), '{}');
    const initial = await initializeProject(root, 'A synthetic route community');
    await approveProject(root, initial.revision); await disableAutomaticAnalysis(root);
    dashboard = await startDashboard(root, 0, { autoAI: false, rehearsal: { infer: controlled.infer, prices } });
    browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(dashboard.url); await page.locator('#brief-name').waitFor();
    assert.equal(await page.locator('#product-editor').getAttribute('open'), null);
    assert.equal(await page.getByLabel('What does it do?').isVisible(), false);
    await page.locator('.step[data-step="1"]').click();
    await page.getByLabel('Reel script, ad concept or optional launch idea').fill('Show how to save a favorite route.');
    let intercepted = false;
    await page.route('**/api/rehearsal/prepare', async route => { intercepted = true; await request.promise; await route.continue(); });
    await page.locator('#virtual-prepare').click();
    await page.locator('#virtual-prepare[aria-busy="true"]').waitFor();
    assert.match(await page.locator('#virtual-prepare').textContent(), /Building/);
    assert.equal(await page.locator('#virtual-prepare').isDisabled(), true);
    assert.equal(await page.locator('.step[data-step="0"]').isEnabled(), true);
    await page.locator('.step[data-step="0"]').click(); assert.equal(await page.locator('#brief-name').isVisible(), true);
    await page.locator('.step[data-step="1"]').click(); request.open();
    await page.locator('#virtual-run-status[data-status="planning"]').waitFor();
    assert.equal(intercepted, true);
    assert.equal(await page.locator('#virtual-progress-bar').getAttribute('value'), null);
    assert.equal((await readRehearsal(root)).audience.evaluated, 0);
    assert.equal(await page.locator('#virtual-prepare').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#virtual-phases [data-phase="research"]').getAttribute('data-state'), 'done');
    assert.equal(await page.locator('#virtual-phases [data-phase="plan"]').getAttribute('data-state'), 'active');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.stage-orbit').first().evaluate(element => getComputedStyle(element, '::before').animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); planning.open();
    await page.locator('#virtual-run-status[data-status="ready"]').waitFor();
    assert.equal(await page.getByLabel('AI proposed launch budget').isVisible(), false);
    assert.equal(await page.locator('#virtual-start').isEnabled(), true);
    await page.locator('#virtual-start').click();
    await page.locator('#virtual-run-status[data-status="running"]').waitFor();
    await page.waitForFunction(() => document.getElementById('virtual-elapsed').textContent.includes('running'));
    assert.equal(await page.locator('#virtual-progress-bar').getAttribute('value'), '0');
    assert.equal(await page.locator('#virtual-percent').textContent(), '0%');
    assert.equal(await page.locator('#virtual-start').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('.step[data-step="3"]').isEnabled(), true);
    audience.open();
    await page.waitForFunction(() => document.getElementById('virtual-stage-detail').textContent.includes('recommendations'));
    assert.equal((await readRehearsal(root)).audience.evaluated, 20);
    assert.equal(await page.locator('#virtual-progress-bar').getAttribute('value'), null);
    insights.open(); await page.locator('#virtual-run-status[data-status="completed"]').waitFor();
    assert.equal(await page.locator('#virtual-view-results').isVisible(), true);
    await page.locator('#virtual-view-results').click();
    assert.equal(await page.locator('[data-panel="3"]').isVisible(), true);
    await page.locator('.step[data-step="1"]').click();
    await page.locator('#virtual-brief-settings > summary').click();
    await page.getByLabel('Reel script, ad concept or optional launch idea').fill('A corrected creative that must survive an error.');
    await page.unroute('**/api/rehearsal/prepare');
    await page.route('**/api/rehearsal/prepare', route => route.fulfill({ status: 503, json: { error: 'Model temporarily unavailable. Try again.' } }));
    await page.locator('#virtual-prepare').click();
    await page.locator('#virtual-message').filter({ hasText: 'temporarily unavailable' }).waitFor();
    assert.equal(await page.locator('#virtual-prepare').isEnabled(), true);
    assert.equal(await page.locator('#virtual-prepare').getAttribute('aria-busy'), null);
    assert.equal(await page.getByLabel('Reel script, ad concept or optional launch idea').inputValue(), 'A corrected creative that must survive an error.');
    assert.equal((await readRehearsal(root)).audience.evaluated, 20);
    assert.deepEqual(errors, []);
  } finally {
    for (const latch of [request, planning, audience, insights]) latch.open();
    await waitForRehearsal(root).catch(() => {}); await browser?.close();
    if (dashboard) await new Promise(resolve => dashboard.server.close(resolve));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
