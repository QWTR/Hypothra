import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { initializeProject, approveProject, prepareRehearsal, resumeRehearsal, waitForRehearsal, readRehearsalRecords, pauseRehearsal,
  configureExperience, editRehearsalPlan, validateViewerBatch, readProjectContext, saveProjectDraft, viewerBatchSchema, rehearsalPlanSchema,
  exploreAsViewer, mediaCostReference, writeArtifact, workspace, readRehearsal, rehearsalHistory, rehearsalWorkerState } from '@hypothra/product-lab';
import { fakeInference, prices, plan, viewer } from './rehearsal-fixture.mjs';

async function fixture(fn) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hypothra-rehearsal-')));
  try {
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'app.ts'), 'app.get("/",()=>{});');
    const initialized = await initializeProject(root, 'A synthetic route community');
    await fn(root, initialized);
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

async function prepared(root, config = {}, deps = fakeInference()) {
  await prepareRehearsal(root, { viewers: 12, batchSize: 4, maxAICalls: 100, ...config }, { infer: deps.infer, prices });
  const state = await waitForRehearsal(root);
  assert.equal(state.status, 'ready', state.message);
  return { state, deps };
}

test('AI prepares a complete plan without manual costs or conversion percentages; individual records determine the counts', () => fixture(async (root, init) => {
  const { state, deps } = await prepared(root);
  assert.equal(state.plan.proposedBudget, 1500);
  assert.equal(state.audience.evaluated, 0);
  await assert.rejects(resumeRehearsal(root, state.id, deps), /approve/);
  await approveProject(root, init.revision);
  await resumeRehearsal(root, state.id, deps);
  const result = await waitForRehearsal(root);
  assert.equal(result.status, 'completed', result.message);
  assert.equal(result.audience.evaluated, 12);
  assert.equal(result.audience.watched, 8);
  assert.equal(result.audience.clicked, 4);
  assert.equal(result.audience.installed, 4);
  assert.equal(result.calls.completed, 5); // plan + 3 batches + optimization
  assert.equal(result.calls.inputTokens, 500);
  const records = (await Promise.all([0, 1, 2].map(batch => readRehearsalRecords(root, state.id, batch)))).flatMap(batch => batch.viewers);
  assert.equal(new Set(records.map(person => person.id)).size, 12);
  assert.equal(records.filter(person => person.install).length, result.audience.installed);
  assert.ok(result.optimization.recommendations.every(item => item.basis === 'synthetic-opinion'));
  assert.equal(mediaCostReference(result)[0].costForRequestedViews.typical, 0.24);
}));

test('a 100,000-person target never becomes a fake completed count; call limits and resume preserve exact records', () => fixture(async (root, init) => {
  const { state, deps } = await prepared(root, { viewers: 100000, batchSize: 10, maxAICalls: 2 });
  await approveProject(root, init.revision);
  await resumeRehearsal(root, state.id, deps);
  const stopped = await waitForRehearsal(root);
  assert.equal(stopped.status, 'paused'); assert.equal(stopped.audience.evaluated, 10); assert.equal(stopped.audience.batches, 1);
  const first = await readRehearsalRecords(root, state.id, 0);
  await resumeRehearsal(root, state.id, { ...deps, maxAICalls: 3 });
  const next = await waitForRehearsal(root);
  assert.equal(next.audience.evaluated, 20); assert.equal(next.status, 'paused');
  assert.deepEqual(await readRehearsalRecords(root, state.id, 0), first);
  assert.equal((await readRehearsalRecords(root, state.id, 1)).viewers[0].id, 'v000011');
}));

test('pause waits for the current batch, and competing runs cannot overwrite it', () => fixture(async (root, init) => {
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { reached = resolve; });
  const deps = fakeInference(async schema => { if (schema === viewerBatchSchema) { reached(); await gate; } });
  const { state } = await prepared(root, {}, deps);
  await approveProject(root, init.revision);
  await resumeRehearsal(root, state.id, deps);
  await started;
  await assert.rejects(prepareRehearsal(root, {}, { infer: deps.infer, prices }), /already active/);
  await pauseRehearsal(root, state.id); release();
  const stopped = await waitForRehearsal(root);
  assert.equal(stopped.status, 'paused'); assert.equal(stopped.audience.evaluated, 4);
}));

test('missing or invented viewer IDs and impossible funnel decisions are rejected', () => {
  const assigned = [{ id: 'v1', segmentId: 'drivers' }, { id: 'v2', segmentId: 'skeptics' }];
  const people = assigned.map((item, index) => viewer(item, index));
  assert.throws(() => validateViewerBatch({ viewers: [people[0]] }, assigned), /exactly one/);
  assert.throws(() => validateViewerBatch({ viewers: [people[0], people[0]] }, assigned), /exactly one/);
  const invented = structuredClone(people); invented[1].id = 'invented';
  assert.throws(() => validateViewerBatch({ viewers: invented }, assigned), /changed/);
  const impossible = structuredClone(people); impossible[1].install = true; impossible[1].click = false;
  assert.throws(() => validateViewerBatch({ viewers: impossible }, assigned), /watch/);
});

test('owner corrections are saved, started plans are immutable, and source revisions cannot be mixed', () => fixture(async (root, init) => {
  const { state, deps } = await prepared(root, { maxAICalls: 2 });
  const changed = structuredClone(plan); changed.proposedBudget = 3000;
  await editRehearsalPlan(root, state.id, changed);
  await approveProject(root, init.revision); await resumeRehearsal(root, state.id, deps); await waitForRehearsal(root);
  await assert.rejects(editRehearsalPlan(root, state.id, changed), /unevaluated/);
  const context = await readProjectContext(root), model = structuredClone(context.model); model.project.name = 'Edited product';
  await saveProjectDraft(root, model, context.revision); await approveProject(root, (await readProjectContext(root)).revision);
  await assert.rejects(resumeRehearsal(root, state.id, deps), /matching AI launch/);
}));

test('published-price failures remain unknown and invalid AI plans preserve the previous data', () => fixture(async root => {
  const deps = fakeInference((schema) => { if (schema === rehearsalPlanSchema) { const p = structuredClone(plan); p.channels[0].benchmarkId = null; return p; } });
  await prepareRehearsal(root, {}, { infer: deps.infer, prices: async () => { throw new Error('Offline'); } });
  const result = await waitForRehearsal(root);
  assert.equal(result.status, 'ready'); assert.match(result.market.error, /could not be verified/);
  assert.equal(mediaCostReference(result)[0].costForRequestedViews, null);
  const original = result.plan;
  const invented = structuredClone(original); invented.channels[0].benchmarkId = 'invented-price';
  await assert.rejects(editRehearsalPlan(root, result.id, invented), /invented/);
  assert.deepEqual((await readRehearsal(root)).plan, original);
}));

test('an orphan committed batch is recovered exactly once without spending another viewer inference', () => fixture(async (root, init) => {
  const { state, deps } = await prepared(root, { viewers: 4 });
  const assigned = [1, 2, 3, 4].map(index => ({ id: `v${String(index).padStart(6, '0')}`, segmentId: state.plan.segments[0].id }));
  // Use the exact assignments the worker will request, then simulate a crash after the atomic batch write.
  const crypto = await import('node:crypto');
  for (const item of assigned) { const value = parseInt(crypto.createHash('sha256').update(`${state.id}:${item.id}`).digest('hex').slice(0, 8), 16) / 0x1_0000_0000; item.segmentId = value < 0.5 ? 'drivers' : 'skeptics'; }
  await writeArtifact(join(await workspace(root), `rehearsal-${state.id}`), 'audience-0.json', { viewers: assigned.map(item => viewer(item)) });
  await approveProject(root, init.revision); await resumeRehearsal(root, state.id, deps);
  const result = await waitForRehearsal(root);
  assert.equal(result.audience.evaluated, 4); assert.equal(result.calls.completed, 2); // plan + optimization
}));

test('interested AI users perform real browser actions and retain actual HTTP failures separately from opinions', { timeout: 30_000 }, () => fixture(async (root, init) => {
  const received = [];
  const server = createServer(async (request, response) => {
    if (request.method === 'POST') { let body = ''; for await (const chunk of request) body += chunk; received.push(body); response.writeHead(500); response.end('Synthetic failure'); return; }
    response.setHeader('Content-Type', 'text/html'); response.end('<h1>Join the route community</h1><input id="email" type="email" value="private-input-sentinel"><button id="signup" onclick="fetch(\'/signup\',{method:\'POST\',body:document.querySelector(\'#email\').value}).then(()=>document.querySelector(\'#status\').textContent=\'Failed signup\')">Create account</button><p id="status">No account</p>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { state, deps } = await prepared(root, { viewers: 3, batchSize: 3 });
    await approveProject(root, init.revision); await resumeRehearsal(root, state.id, deps); await waitForRehearsal(root);
    await assert.rejects(configureExperience(root, state.id, { baseUrl: 'https://example.com/', users: 1, syntheticTestData: true }), /local test origin/);
    await assert.rejects(configureExperience(root, state.id, { baseUrl: 'http://127.0.0.1:1234/', users: 1, syntheticTestData: false }));
    await configureExperience(root, state.id, { baseUrl: `http://127.0.0.1:${server.address().port}/`, users: 5000, syntheticTestData: true });
    await resumeRehearsal(root, state.id, deps);
    const result = await waitForRehearsal(root);
    assert.equal(result.status, 'completed', result.message);
    assert.equal(result.experience.target, 1); assert.equal(result.experience.tested, 1);
    assert.equal(result.experience.blocked, 1); assert.equal(result.experience.satisfied, 0);
    assert.match(received[0], /@example\.invalid/);
    assert.ok(result.experience.samples[0].actions.every(action => action.result === 'performed'));
    assert.match(result.experience.samples[0].runtimeErrors.join(' '), /HTTP 500/);
    assert.ok(result.activity.some(event => event.kind === 'saved' && /Clicked/.test(event.label)));
    assert.ok(result.activity.every(event => Number.isFinite(Date.parse(event.at))));
    assert.doesNotMatch(JSON.stringify(result.experience.samples[0].observations), /private-input-sentinel/);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));

test('a model-invented selector is blocked rather than reported as an application defect', { timeout: 15_000 }, () => fixture(async (_root, init) => {
  const server = createServer((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<h1>Route community</h1><button id="join">Join</button>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const deps = fakeInference((schema, data) => ({ action: 'click', selector: '#invented', inputKind: 'none', reason: 'Try a control', verdict: 'continue', feedback: 'Try joining', evidenceIds: [data.currentObservation.id] }));
    const result = await exploreAsViewer(viewer({ id: 'v000001', segmentId: 'drivers' }), init.model, `http://127.0.0.1:${server.address().port}/`, deps.infer, 'test-run');
    assert.equal(result.outcome, 'blocked'); assert.equal(result.actions[0].result, 'blocked'); assert.deepEqual(result.runtimeErrors, []);
    assert.match(result.feedback, /not evidence of an application bug/);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));

test('a stopped process can resume safely and previous variants retain their plan and counts', () => fixture(async (root, init) => {
  const { state, deps } = await prepared(root, { viewers: 4 });
  await writeFile(join(await workspace(root), '.rehearsal-run.lock'), JSON.stringify({ pid: 2147483646, createdAt: new Date().toISOString() }));
  assert.equal(await rehearsalWorkerState(root), 'interrupted');
  await approveProject(root, init.revision); await resumeRehearsal(root, state.id, deps);
  assert.equal((await waitForRehearsal(root)).status, 'completed');
  await prepared(root, { viewers: 6 });
  const history = await rehearsalHistory(root);
  assert.equal(history.length, 2);
  assert.equal(history.find(item => item.id === state.id).evaluated, 4);
  assert.equal(history.find(item => item.id === state.id).status, 'completed');
}));
