import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
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
  const invoke = args => spawnSync(process.execPath, [fileURLToPath(cli), ...args], { encoding: 'utf8' });
  assert.equal(invoke(['plan', source]).status, 0);
  assert.deepEqual(await fs.readdir(root), ['input.js']);
  assert.equal(invoke(['build', source]).status, 1);
  assert.equal(invoke(['plan', source, '--decoys', 'invalid']).status, 1);
});

test('synthetic comments preserve evaluation completion values without globals', async () => {
  for (const source of ['21 * 2', '"use strict"; 42;', 'var x = 7; x;', 'if (true) { 19; }']) {
    const { code } = await transform(source, { decoys: 64 });
    const a = {}, b = {};
    assert.equal(vm.runInNewContext(source, a), vm.runInNewContext(code, b));
    assert.deepEqual(Object.keys(a), Object.keys(b));
  }
});

test('default preserves inferred names, parameters, getters, async and class behavior', async () => {
  const source = `
    const calculateInvoice = (quantity, price) => quantity * price;
    const Account = class { #balance = 3; get balance() { return this.#balance; } };
    async function later(x) { return x + 1; }
    module.exports = { calculateInvoice, Account, later };
  `;
  const { code } = await transform(source);
  const context = { module: { exports: {} } };
  vm.runInNewContext(code, context);
  const api = context.module.exports;
  assert.equal(api.calculateInvoice.name, 'calculateInvoice');
  assert.equal(api.calculateInvoice.length, 2);
  assert.equal(api.Account.name, 'Account');
  assert.equal(new api.Account().balance, 3);
  assert.equal(await api.later(2), 3);
  assert.match(code, /quantity/);
});

test('preflight rejects missing dependencies and location-sensitive code', async () => {
  for (const source of [
    'import value from "./chunk.js";', 'export * from "./chunk.js";',
    'import("./chunk.js")', 'import(name)', 'console.log(import.meta.url)',
    'require("./asset.json")', 'require(name)', 'require.resolve("pkg")',
    'console.log(__dirname)', 'new Worker("worker.js")', 'fetch("./data.json")',
    'eval("1")', 'new Function("return 1")'
  ]) await assert.rejects(transform(source, { module: true }), /self-contained/);
  const result = await transform('fetch("./data.json")', { allowExternal: true });
  assert.ok(result.warnings.length);
  await transform('import fs from "node:fs";', { module: true });
});

test('plan actually parses input and estimates exact output without writes', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs');
  await fs.writeFile(source, 'module.exports = 42');
  const { plan } = await import('../src/core.js');
  const p = await plan(source, { decoys: 10 });
  const b = await build(source, path.join(root, 'release'), { decoys: 10 });
  assert.deepEqual(p.metrics, b.metrics);
  await fs.writeFile(source, 'function {');
  await assert.rejects(plan(source));
});

test('module metadata survives relocation and participates in verification', async t => {
  const root = await temp(t), source = path.join(root, 'input.js'), out = path.join(root, 'release');
  await fs.writeFile(source, 'export default 17');
  await build(source, out, { module: true });
  assert.equal((await import(pathToFileURL(path.join(out, 'input.js')))).default, 17);
  assert.equal((await verify(out)).packageValid, true);
  await fs.writeFile(path.join(out, 'package.json'), '{"type":"commonjs"}');
  assert.equal((await verify(out)).valid, false);
});

test('commonjs output does not inherit a parent module type', async t => {
  const root = await temp(t), source = path.join(root, 'input.js'), out = path.join(root, 'release');
  await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await fs.writeFile(source, 'module.exports = 91');
  await build(source, out);
  const result = spawnSync(process.execPath, ['-e', 'console.log(require(process.argv[1]))', path.join(out, 'input.js')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '91');
});

test('application checks gate success and failed checks remove generated artifacts', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs');
  await fs.writeFile(source, 'if (2 + 2 !== 4) process.exit(1)');
  const successful = await build(source, path.join(root, 'pass'), {}, [process.execPath, '{artifact}']);
  assert.equal(successful.validation.applicationCheck, 'passed');
  const failed = path.join(root, 'fail');
  await assert.rejects(build(source, failed, {}, [process.execPath, '-e', 'process.exit(4)']), /exit 4/);
  await assert.rejects(fs.stat(failed), { code: 'ENOENT' });
  const changed = path.join(root, 'changed');
  await assert.rejects(build(source, changed, {}, [process.execPath, '-e', 'require("node:fs").appendFileSync(process.argv[1], " // edit")', '{artifact}']), /modified/);
});

test('malformed UTF-8, incompatible options and output aliases are rejected', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs');
  await fs.writeFile(source, Buffer.from([0xff, 0xfe]));
  await assert.rejects(build(source, path.join(root, 'output')));
  await fs.writeFile(source, 'module.exports = 1');
  await assert.rejects(build(source, root));
  await assert.rejects(build(source, source));
  await assert.rejects(build(source, path.join(root, 'output'), { module: true }), /cannot/);
  await assert.rejects(transform('1', { mangl: true }), /Unknown option/);
  assert.equal(await fs.readFile(source, 'utf8'), 'module.exports = 1');
});

test('shebang and executable permission survive packaging', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs'), out = path.join(root, 'release');
  await fs.writeFile(source, '#!/usr/bin/env node\nconsole.log("hello")', { mode: 0o755 });
  await build(source, out);
  assert.match(await fs.readFile(path.join(out, 'input.cjs'), 'utf8'), /^#!\/usr\/bin\/env node/);
  if (process.platform !== 'win32') assert.equal((await fs.stat(path.join(out, 'input.cjs'))).mode & 0o111, 0o111);
});

test('symlink input and manifest rejected where symlinks are available', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs');
  await fs.writeFile(source, 'module.exports = 1');
  try { await fs.symlink(source, path.join(root, 'linked.cjs')); }
  catch (error) { if (error.code === 'EPERM') { t.skip('OS disallows unprivileged symlinks'); return; } throw error; }
  await assert.rejects(build(path.join(root, 'linked.cjs'), path.join(root, 'release')), /symlinks/);
  const out = path.join(root, 'real');
  await build(source, out);
  await fs.rename(path.join(out, 'manifest.json'), path.join(root, 'manifest-backup.json'));
  await fs.symlink(path.join(root, 'manifest-backup.json'), path.join(out, 'manifest.json'));
  await assert.rejects(verify(out), /symlinks/);
});

test('releases reproduce byte-for-byte and original files remain unchanged', async t => {
  const root = await temp(t), source = path.join(root, 'input.cjs');
  const original = Buffer.from('/*! License */\r\nmodule.exports = 7;\r\n');
  await fs.writeFile(source, original);
  for (const name of ['one', 'two']) await build(source, path.join(root, name), { decoys: 64, seed: 'fixed' });
  for (const name of ['input.cjs', 'package.json', 'manifest.json']) assert.deepEqual(await fs.readFile(path.join(root, 'one', name)), await fs.readFile(path.join(root, 'two', name)));
  assert.deepEqual(await fs.readFile(source), original);
});

test('unknown and malformed CLI options fail rather than being ignored', () => {
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  for (const args of [['verify', 'release', '--decoys', '4'], ['plan', 'a.js', '--check', '[]'], ['plan', 'a.js', '--decoys', ''], ['plan', 'a.js', '--decoys', '1e2']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(JSON.parse(result.stderr).error);
  }
});
