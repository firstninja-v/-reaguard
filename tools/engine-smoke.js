import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'reaguard-engine-smoke-'));
const run = (program, args, cwd = directory) => {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${program} ${args.join(' ')}\n${result.stderr}`);
  return result.stdout;
};
try {
  const source = 'const marker = "sourceMappingURL=must-survive";\nconsole.log(marker);\n';
  await fs.writeFile(path.join(directory, 'app.cjs'), source);
  await fs.writeFile(path.join(directory, 'die-a-rea.toml'), '[project]\nname="smoke"\n[policy]\nprofile="low"\n[randomization]\nenabled=false\n[tarpit]\nenabled=false\n[verify]\njs_syntax=true\n[[targets]]\npath="app.cjs"\n');
  JSON.parse(run(process.execPath, [cli, 'engine', 'doctor', '--json']));
  JSON.parse(run(process.execPath, [cli, 'engine', 'plan', '--json']));
  run(process.execPath, [cli, 'engine', 'build', '--out', 'release']);
  assert.equal(run(process.execPath, ['release/app.cjs']), run(process.execPath, ['app.cjs']));
  assert.equal(await fs.readFile(path.join(directory, 'app.cjs'), 'utf8'), source);
  const report = JSON.parse(run(process.execPath, [cli, 'engine', 'verify', '--original', 'app.cjs', '--hardened', 'release/app.cjs', '--json']));
  assert.equal(typeof report.rrs, 'number');
  if (process.platform === 'linux') {
    await fs.writeFile(path.join(directory, 'app.c'), '#include <stdio.h>\nint main(void){puts("native-ok");return 0;}\n');
    run('cc', ['-g', 'app.c', '-o', 'app']);
    await fs.writeFile(path.join(directory, 'die-a-rea.toml'), '[project]\nname="native"\n[policy]\nprofile="low"\n[randomization]\nenabled=false\n[tarpit]\nenabled=false\n[[targets]]\npath="app"\n');
    const baseline = await fs.readFile(path.join(directory, 'app'));
    run(process.execPath, [cli, 'engine', 'build', '--out', 'native-release']);
    assert.equal(run(path.join(directory, 'native-release/app'), []), run(path.join(directory, 'app'), []));
    assert.deepEqual(await fs.readFile(path.join(directory, 'app')), baseline);
  }
  console.log('Engine wrapper, JS behavior, static verification and supported native smoke passed');
} finally { await fs.rm(directory, { recursive: true, force: true }); }
