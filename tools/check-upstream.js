import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(await fs.readFile(path.join(root, 'UPSTREAM.json'), 'utf8'));
const patches = JSON.parse(await fs.readFile(path.join(root, 'UPSTREAM_PATCHES.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let checked = 0;
for (const [name, record] of Object.entries(inventory.files)) {
  const bytes = await fs.readFile(path.join(root, 'engine', name));
  const normalized = bytes.includes(0) ? bytes : Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  const expected = patches.modified[name]?.sha256 ?? record.sha256;
  if (hash(normalized) !== expected) throw new Error(`Unrecorded upstream change: ${name}`);
  checked++;
}
for (const name of Object.keys(patches.modified)) {
  if (!inventory.files[name]) throw new Error(`Patch references unknown upstream file: ${name}`);
}
for (const [name, record] of Object.entries(patches.added)) {
  if (inventory.files[name]) throw new Error(`Addition already exists upstream: ${name}`);
  const data = await fs.readFile(path.join(root, 'engine', name), 'utf8');
  if (hash(data.replaceAll('\r\n', '\n')) !== record.sha256) throw new Error(`Unrecorded addition change: ${name}`);
}
console.log(JSON.stringify({ originalFiles: checked, modifiedFiles: Object.keys(patches.modified).length, addedFiles: Object.keys(patches.added).length, commit: inventory.commit }));
