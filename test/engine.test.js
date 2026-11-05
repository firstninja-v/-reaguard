import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { locateEngine, runEngine } from '../src/engine.js';

test('missing engine gives actionable installation guidance', async () => {
  await assert.rejects(locateEngine({ REAGUARD_ENGINE_BIN: path.join(os.tmpdir(), 'missing-reaguard-binary') }), /npm run engine:build/);
});

test('engine bridge preserves arguments, caller directory and exit status without a shell', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'reaguard engine '));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const marker = path.join(directory, 'result.json');
  const unusual = 'literal; $(echo no) & space';
  const code = await runEngine(['-e', 'require("node:fs").writeFileSync(process.argv[1], JSON.stringify({cwd:process.cwd(),arg:process.argv[2]}));process.exit(7)', marker, unusual], {
    environment: { ...process.env, REAGUARD_ENGINE_BIN: process.execPath }, cwd: directory, stdio: 'ignore'
  });
  assert.equal(code, 7);
  assert.deepEqual(JSON.parse(await fs.readFile(marker, 'utf8')), { cwd: directory, arg: unusual });
});

test('CLI sends engine options through without JavaScript option parsing', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), 'engine', '-e', 'process.exit(9)'], {
    encoding: 'utf8', env: { ...process.env, REAGUARD_ENGINE_BIN: process.execPath }
  });
  assert.equal(result.status, 9, result.stderr);
});

test('upstream CommonJS adapters retain their module context', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../engine/adapters/js/direa-js', import.meta.url))], {
    input: JSON.stringify({ op: 'capabilities' }), encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).adapter, 'js');
});
