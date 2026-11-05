import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { transform, build, verify } from '../src/core.js';

async function temp(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reaguard-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('preserves CommonJS outputs, errors, regex, templates and strict mode', async () => {
  const source = await fs.readFile(new URL('../examples/calculator.cjs', import.meta.url), 'utf8');
  const extra = '\nmodule.exports.text = x => `${/a+b/.test(x)}:${"https://example.test"}`;';
  const { code } = await transform(source + extra, { decoys: 100 });
  const load = text => { const context = { module: { exports: {} } }; vm.runInNewContext(text, context); return context.module.exports; };
  const before = load(source + extra), after = load(code);
  for (const discount of [0, .1, .5, 1]) assert.equal(after.total([{ price: 19.95, quantity: 3 }], discount), before.total([{ price: 19.95, quantity: 3 }], discount));
  assert.throws(() => after.total([], 2), /Invalid order/);
  assert.equal(after.text('aaab'), before.text('aaab'));
  assert.equal(after.total.name, 'total');
});
test('deterministic data, distinct seeds and bounded growth', async () => {
  const a = await transform('const x = 1;', { decoys: 20, seed: 'a' });
  assert.deepEqual(a, await transform('const x = 1;', { decoys: 20, seed: 'a' }));
  assert.notEqual(a.code, (await transform('const x = 1;', { decoys: 20, seed: 'b' })).code);
  await assert.rejects(transform('x()', { decoys: 100, maxGrowth: 10 }), /budget/);
  for (const decoys of [-1, 1.5, 4097, NaN]) await assert.rejects(transform('x()', { decoys }), /Decoys/);
});
test('preserves notices and drops source map comments without corrupting strings', async () => {
  const { code } = await transform('/*! Copyright Example */\nconst url = "//# sourceMappingURL=literal";\n//# sourceMappingURL=private.map');
  assert.match(code, /Copyright Example/);
  assert.match(code, /sourceMappingURL=literal/);
  assert.doesNotMatch(code, /private.map/);
});
test('build integrity, refusal to overwrite, and tamper detection', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs'), out = path.join(root, 'release');
  await fs.writeFile(source, 'module.exports = 42;');
  await build(source, out, { decoys: 10 });
  assert.equal((await verify(out)).valid, true);
  await assert.rejects(build(source, out));
  assert.equal(await fs.readFile(source, 'utf8'), 'module.exports = 42;');
  await fs.appendFile(path.join(out, 'input.cjs'), '\n// modification');
  assert.equal((await verify(out)).valid, false);
});
test('failed transform cleans reserved output', async t => {
  const root = await temp(t), source = path.join(root, 'bad.js'), out = path.join(root, 'release');
  await fs.writeFile(source, 'function {');
  await assert.rejects(build(source, out));
  await assert.rejects(fs.stat(out), { code: 'ENOENT' });
});
test('ES module exports remain usable', async t => {
  const root = await temp(t), source = path.join(root, 'input.mjs'), out = path.join(root, 'release');
  await fs.writeFile(source, 'export const add = (a, b) => a + b; export default "ready";');
  await build(source, out, { decoys: 20 });
  const result = await import(pathToFileURL(path.join(out, 'input.mjs')));
  assert.equal(result.add(7, 8), 15);
  assert.equal(result.default, 'ready');
});
test('manifest traversal is rejected', async t => {
  const root = await temp(t);
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ schema: 1, artifact: '../secret.js' }));
  await assert.rejects(verify(root), /Invalid manifest/);
});
test('CLI reports errors and dry-run makes no output', async t => {
  const root = await temp(t), source = path.join(root, 'input.js');
  await fs.writeFile(source, 'console.log(1);');
  const cli = new URL('../src/cli.js', import.meta.url);
  const invoke = args => spawnSync(process.execPath, [cli.pathname.replace(/^\/(\w:)/, '$1'), ...args], { encoding: 'utf8' });
  assert.equal(invoke(['plan', source]).status, 0);
  assert.deepEqual(await fs.readdir(root), ['input.js']);
  assert.equal(invoke(['build', source]).status, 1);
  assert.equal(invoke(['plan', source, '--decoys', 'invalid']).status, 1);
});
