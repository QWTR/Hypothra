import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { replaceArtifactFile } from '@hypothra/product-lab';

test('an atomic artifact replacement retries a temporary Windows lock without losing the previous complete file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hypothra-storage-'));
  try {
    const source = join(root, 'next.json'), target = join(root, 'state.json');
    await writeFile(source, '{"evaluated":20}'); await writeFile(target, '{"evaluated":10}');
    let attempts = 0;
    await replaceArtifactFile(source, target, async (from, to) => {
      assert.equal(await readFile(target, 'utf8'), '{"evaluated":10}');
      if (++attempts < 3) throw Object.assign(new Error('Transient Windows reader lock'), { code: 'EPERM' });
      await rename(from, to);
    });
    assert.equal(attempts, 3); assert.equal(await readFile(target, 'utf8'), '{"evaluated":20}');
    await writeFile(source, '{}');
    await assert.rejects(replaceArtifactFile(source, target, async () => { throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' }); }), { code: 'ENOSPC' });
    assert.equal(await readFile(target, 'utf8'), '{"evaluated":20}');
  } finally { await rm(root, { recursive: true, force: true }); }
});
