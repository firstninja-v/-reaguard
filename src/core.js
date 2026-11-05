import { minify } from 'terser';
import { parse } from 'acorn';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { isBuiltin } from 'node:module';
import path from 'node:path';

export const VERSION = '0.2.0';
const MAX_SOURCE = 16 * 1024 * 1024;
const MAX_OUTPUT = MAX_SOURCE * 8;
export const digest = data => createHash('sha256').update(data).digest('hex');

function options(input = {}) {
  const value = { seed: 'release', decoys: 0, maxGrowth: 262144, module: false, mangle: false, allowExternal: false, ...input };
  for (const key of Object.keys(input)) if (!['seed', 'decoys', 'maxGrowth', 'module', 'mangle', 'allowExternal'].includes(key)) throw new Error(`Unknown option: ${key}`);
  if (typeof value.seed !== 'string' || !value.seed.length || value.seed.length > 256) throw new Error('Seed must contain 1–256 characters');
  if (!Number.isInteger(value.decoys) || value.decoys < 0 || value.decoys > 4096) throw new Error('Decoys must be an integer from 0 to 4096');
  if (!Number.isInteger(value.maxGrowth) || value.maxGrowth < 0 || value.maxGrowth > 1048576) throw new Error('Growth budget must be 0–1048576 bytes');
  for (const key of ['module', 'mangle', 'allowExternal']) if (typeof value[key] !== 'boolean') throw new Error(`${key} must be boolean`);
  return value;
}

function inspect(source, config) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: config.module ? 'module' : 'script', allowHashBang: true });
  const risks = new Set();
  const pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
      if (!isBuiltin(node.source.value)) risks.add('external module dependency');
    }
    if (node.type === 'ImportExpression') {
      if (node.source.type !== 'Literal' || !isBuiltin(node.source.value)) risks.add('dynamic import dependency');
    }
    if (node.type === 'Identifier' && ['__dirname', '__filename'].includes(node.name)) risks.add('location-dependent Node path');
    if (node.type === 'MetaProperty' && node.meta.name === 'import') risks.add('location-dependent import.meta');
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee.type === 'Identifier' && callee.name === 'require') {
        const arg = node.arguments[0];
        if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string' || !isBuiltin(arg.value)) risks.add('CommonJS dependency');
      }
      if (callee.type === 'Identifier' && ['eval', 'fetch', 'importScripts'].includes(callee.name)) risks.add(`dynamic code or resource: ${callee.name}`);
      if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'require') risks.add('CommonJS resolver');
    }
    if (['CallExpression', 'NewExpression'].includes(node.type) && node.callee.type === 'Identifier' && ['Function', 'Worker', 'SharedWorker', 'URL'].includes(node.callee.name)) risks.add(`dynamic code or resource: ${node.callee.name}`);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) pending.push(child); }
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  return [...risks].sort();
}

export async function transform(source, input = {}) {
  const config = options(input);
  if (typeof source !== 'string') throw new Error('Source must be UTF-8 text');
  if (Buffer.byteLength(source) > MAX_SOURCE) throw new Error('Input exceeds 16 MiB');
  const risks = inspect(source, config);
  if (risks.length && !config.allowExternal) throw new Error(`Input is not demonstrably self-contained (${risks.join(', ')}). Bundle dependencies first, or use --allow-external only after reviewing deployment paths.`);
  const result = await minify(source, {
    module: config.module, compress: false,
    mangle: config.mangle ? { toplevel: false, eval: false, properties: false } : false,
    keep_fnames: true, keep_classnames: true,
    format: { comments: /@license|@preserve|copyright|^!/i, ascii_only: true, inline_script: true }
  });
  const rows = Array.from({ length: config.decoys }, (_, i) => {
    const key = digest(`${config.seed}:${i}`);
    return [key.slice(0, 20), parseInt(key.slice(20, 28), 16), key.slice(28, 52)];
  });
  // Comments do not change completion values or allocate runtime arrays.
  const padding = rows.length ? `\n/* REAguard synthetic data (non-executable)\n${JSON.stringify(rows)}\n*/\n` : '\n';
  if (rows.length && Buffer.byteLength(padding) > config.maxGrowth) throw new Error('Synthetic data exceeds growth budget');
  const code = result.code + padding;
  if (Buffer.byteLength(code) > MAX_OUTPUT) throw new Error('Output exceeds size limit');
  inspect(code, config); // Parse the complete final artifact, including appended data.
  return { code, warnings: risks, metrics: {
    originalBytes: Buffer.byteLength(source), minifiedBytes: Buffer.byteLength(result.code),
    outputBytes: Buffer.byteLength(code), syntheticBytes: rows.length ? Buffer.byteLength(padding) : 0,
    syntheticRecords: rows.length
  } };
}

async function readRegular(filename, limit) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('Expected a regular file within the size limit (symlinks are not supported)');
  const data = await fs.readFile(filename);
  if (data.length > limit) throw new Error('File exceeds size limit');
  return { data, stat };
}

async function prepare(filename, input) {
  const config = options(input);
  const source = path.resolve(filename);
  const extension = path.extname(source);
  if (!['.js', '.cjs', '.mjs'].includes(extension)) throw new Error('Supported inputs: .js, .cjs, .mjs');
  if (extension === '.cjs' && config.module) throw new Error('--module cannot be used with .cjs');
  config.module ||= extension === '.mjs';
  const { data, stat } = await readRegular(source, MAX_SOURCE);
  // Preserve BOM semantics; reject malformed UTF-8 instead of silently replacing bytes.
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data);
  const transformed = await transform(text, config);
  return { source, config, data, stat, ...transformed };
}

export async function plan(filename, input = {}) {
  const result = await prepare(filename, input);
  return { source: result.source, config: result.config, metrics: result.metrics, warnings: result.warnings, syntaxChecked: true };
}

async function runCheck(argv, directory, artifact) {
  if (!Array.isArray(argv) || !argv.length || argv.some(x => typeof x !== 'string' || !x.length)) throw new Error('Check must be a nonempty JSON array of command arguments');
  const args = argv.map(arg => arg.replaceAll('{artifact}', artifact).replaceAll('{out}', directory));
  await new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { cwd: directory, shell: false, stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Application check timed out after 30 seconds')); }, 30000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Application check failed (exit ${code})`)); });
  });
}

export async function build(filename, out, input = {}, check) {
  if (typeof out !== 'string' || !out.length) throw new Error('Output directory is required');
  const result = await prepare(filename, input); // Fail before creating output.
  const destination = path.resolve(out);
  await fs.mkdir(destination); // Exclusive reservation: never reuse or overwrite.
  const created = [];
  try {
    const artifact = path.basename(result.source);
    const artifactPath = path.join(destination, artifact);
    const write = async (name, content, mode) => {
      const target = path.join(destination, name);
      const handle = await fs.open(target, 'wx', mode);
      created.push(target);
      try { await handle.writeFile(content); }
      finally { await handle.close(); }
    };
    await write(artifact, result.code, result.stat.mode & 0o777);
    // Avoid inheriting a different package type from the output's parent.
    const packageText = JSON.stringify({ private: true, type: result.config.module ? 'module' : 'commonjs' }, null, 2) + '\n';
    await write('package.json', packageText);
    if (check) await runCheck(check, destination, artifactPath);
    if (digest(await fs.readFile(artifactPath)) !== digest(result.code) || digest(await fs.readFile(path.join(destination, 'package.json'))) !== digest(packageText)) throw new Error('Application check modified release files');
    const manifest = {
      schema: 2, tool: 'reaguard', version: VERSION, artifact,
      sourceSha256: digest(result.data), artifactSha256: digest(result.code), packageSha256: digest(packageText),
      config: result.config, metrics: result.metrics, warnings: result.warnings,
      validation: { syntax: true, applicationCheck: check ? 'passed' : 'not-run' }
    };
    await write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
  } catch (error) {
    // Remove only files created here. Never recursively delete user/check-created files.
    for (const target of created.reverse()) await fs.unlink(target).catch(() => {});
    await fs.rmdir(destination).catch(() => {});
    throw error;
  }
}

export async function verify(directory) {
  const root = await fs.realpath(directory);
  const { data: raw } = await readRegular(path.join(root, 'manifest.json'), 65536);
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  if (![1, 2].includes(manifest.schema) || manifest.tool !== 'reaguard' || typeof manifest.artifact !== 'string' || !/^[^/\\:\x00-\x1f]+\.(?:js|cjs|mjs)$/.test(manifest.artifact) || !/^[a-f0-9]{64}$/.test(manifest.artifactSha256)) throw new Error('Invalid manifest');
  const { data } = await readRegular(path.join(root, manifest.artifact), MAX_OUTPUT);
  let packageValid = null;
  if (manifest.schema === 2) {
    if (!/^[a-f0-9]{64}$/.test(manifest.packageSha256)) throw new Error('Invalid package digest');
    const pkg = await readRegular(path.join(root, 'package.json'), 65536);
    packageValid = digest(pkg.data) === manifest.packageSha256;
  }
  const valid = digest(data) === manifest.artifactSha256 && packageValid !== false;
  return { valid, artifact: manifest.artifact, bytes: data.length, packageValid, expectedSha256: manifest.artifactSha256, actualSha256: digest(data) };
}
