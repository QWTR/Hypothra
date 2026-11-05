import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeProject, rehearsalPlanSchema, viewerBatchSchema, optimizationSchema } from '@hypothra/product-lab';
import { fakeInference, plan } from './rehearsal-fixture.mjs';

test('CLI prepares and resumes an AI launch across separate processes using a controlled local model endpoint', { timeout: 40_000 }, async () => {
  const area = await mkdtemp(join(tmpdir(), 'hypothra-ai-cli-')), root = join(area, 'project');
  const fake = fakeInference((schema) => { if (schema === rehearsalPlanSchema) { const p = structuredClone(plan); p.channels[0].benchmarkId = null; return p; } });
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.headers.authorization, undefined);
      let body = ''; for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body), instructions = payload.messages[0].content, data = JSON.parse(payload.messages[1].content);
      const schema = instructions.includes('Prepare a complete virtual') ? rehearsalPlanSchema : instructions.includes('For EACH assigned ID') ? viewerBatchSchema : optimizationSchema;
      const generated = await fake.infer(schema, instructions, data);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated.value) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
    } catch { response.writeHead(500); response.end('Controlled fixture rejected the request'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await mkdir(root); await writeFile(join(root, 'package.json'), '{}');
    const initial = await initializeProject(root, 'A synthetic route product');
    const hook = join(area, 'offline-guard.mjs');
    await writeFile(hook, `const realFetch=globalThis.fetch;globalThis.fetch=(input,options)=>String(input).startsWith('http://127.0.0.1:${server.address().port}/')?realFetch(input,options):Promise.reject(new Error('External network disabled by fixture'));`);
    const env = { ...process.env, HYPOTHRA_AI_MODE: 'controlled-local-fixture', HYPOTHRA_MODEL_TOKEN: '', HYPOTHRA_AI_ENDPOINT: `http://127.0.0.1:${server.address().port}/v1/chat/completions`, HYPOTHRA_AI_MODEL: 'fixture-model', NODE_OPTIONS: `--import=${pathToFileURL(hook).href}` };
    const run = async args => JSON.parse((await promisify(execFile)(process.execPath, [resolve('packages/cli/dist/index.js'), ...args], { env, windowsHide: true, maxBuffer: 2 * 1024 * 1024 })).stdout);
    const ready = await run(['rehearse', 'prepare', root, '--viewers', '6', '--max-ai-calls', '20']);
    assert.equal(ready.status, 'ready'); assert.equal(ready.plan.proposedBudget, 1500); assert.match(ready.market.error, /could not be verified/);
    await run(['approve', root, '--revision', initial.revision]);
    const result = await run(['rehearse', 'run', root]);
    assert.equal(result.status, 'completed', result.message); assert.equal(result.audience.evaluated, 6);
    assert.equal(result.calls.completed, 3); assert.equal(result.calls.inputTokens, 300); assert.equal(result.calls.provider, 'configured-model');
    const saved = await run(['rehearse', 'status', root]); assert.deepEqual(saved.audience, result.audience);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
