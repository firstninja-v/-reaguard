import { minify } from 'terser';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_SOURCE = 16 * 1024 * 1024;
const MAX_DECOYS = 4096;
export const digest = data => createHash('sha256').update(data).digest('hex');

function options(input = {}) {
  const value = { seed: 'release', decoys: 0, maxGrowth: 262144, module: false, ...input };
  if (typeof value.seed !== 'string' || !value.seed.length || value.seed.length > 256) throw new Error('Seed must contain 1–256 characters');
  if (!Number.isInteger(value.decoys) || value.decoys < 0 || value.decoys > MAX_DECOYS) throw new Error('Decoys must be an integer from 0 to 4096');
  if (!Number.isInteger(value.maxGrowth) || value.maxGrowth < 0 || value.maxGrowth > 1048576) throw new Error('Growth budget must be 0–1048576 bytes');
  if (typeof value.module !== 'boolean') throw new Error('Module option must be boolean');
  return value;
}

export async function transform(source, input = {}) {
  const config = options(input);
  if (Buffer.byteLength(source) > MAX_SOURCE) throw new Error('Input exceeds 16 MiB');
  // Preserve public properties, top-level bindings and legally significant comments.
  const result = await minify(source, {
    module: config.module, compress: false, mangle: { toplevel: false },
    keep_fnames: true, keep_classnames: true,
    format: { comments: /@license|@preserve|copyright|^!/i, ascii_only: true }
  });
  const baseline = result.code;
  // A discarded literal has no globals, function calls, I/O or runtime hooks.
  // Generate after minification so an optimizer does not remove the optional data.
  const rows = Array.from({ length: config.decoys }, (_, i) => {
    const key = digest(`${config.seed}:${i}`);
    return [key.slice(0, 20), parseInt(key.slice(20, 28), 16), key.slice(28, 52)];
  });
  const padding = rows.length ? `\n;void ${JSON.stringify(rows)};\n` : '\n';
  if (Buffer.byteLength(padding) > config.maxGrowth && rows.length) throw new Error('Synthetic data exceeds growth budget');
  const code = baseline + padding;
  return { code, metrics: {
    originalBytes: Buffer.byteLength(source), minifiedBytes: Buffer.byteLength(baseline),
    outputBytes: Buffer.byteLength(code), syntheticBytes: rows.length ? Buffer.byteLength(padding) : 0,
    syntheticRecords: rows.length
  } };
}

export async function plan(filename, input = {}) {
  const config = options(input);
  const source = await fs.realpath(filename);
  const stat = await fs.stat(source);
  if (!stat.isFile() || stat.size > MAX_SOURCE) throw new Error('Input must be a file no larger than 16 MiB');
  if (!['.js', '.cjs', '.mjs'].includes(path.extname(source))) throw new Error('Supported inputs: .js, .cjs, .mjs');
  return { source, config: { ...config, module: config.module || source.endsWith('.mjs') } };
}

export async function build(filename, out, input = {}) {
  const planned = await plan(filename, input);
  const destination = path.resolve(out);
  // Reserve a brand-new directory; never replace existing files or follow a destination symlink.
  await fs.mkdir(destination);
  try {
    const source = await fs.readFile(planned.source, 'utf8');
    const { code, metrics } = await transform(source, planned.config);
    const artifact = path.basename(planned.source);
    const manifest = {
      schema: 1, tool: 'reaguard', version: '0.1.0', artifact,
      sourceSha256: digest(source), artifactSha256: digest(code),
      config: planned.config, metrics
    };
    await fs.writeFile(path.join(destination, artifact), code, { flag: 'wx' });
    await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return manifest;
  } catch (error) {
    // Only files in the newly reserved directory can have been created by this operation.
    for (const name of [path.basename(planned.source), 'manifest.json']) await fs.unlink(path.join(destination, name)).catch(() => {});
    await fs.rmdir(destination).catch(() => {});
    throw error;
  }
}

export async function verify(directory) {
  const root = await fs.realpath(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || typeof manifest.artifact !== 'string' || !/^[^/\\:]+\.(?:js|cjs|mjs)$/.test(manifest.artifact)) throw new Error('Invalid manifest');
  const artifact = path.join(root, manifest.artifact);
  if ((await fs.lstat(artifact)).isSymbolicLink()) throw new Error('Artifact must not be a symlink');
  const data = await fs.readFile(artifact);
  const valid = digest(data) === manifest.artifactSha256;
  return { valid, artifact: manifest.artifact, bytes: data.length, expectedSha256: manifest.artifactSha256, actualSha256: digest(data) };
}
