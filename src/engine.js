import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const engineRoot = fileURLToPath(new URL('../engine/', import.meta.url));

export async function locateEngine(environment = process.env) {
  const executable = process.platform === 'win32' ? 'die-a-rea.exe' : 'die-a-rea';
  const candidates = environment.REAGUARD_ENGINE_BIN
    ? [path.resolve(environment.REAGUARD_ENGINE_BIN)]
    : ['release', 'debug'].map(profile => path.join(engineRoot, 'target', profile, executable));
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('Rust engine is not built. Install Rust and run npm run engine:build, or set REAGUARD_ENGINE_BIN to your built executable.');
}

export async function runEngine(args, { environment = process.env, cwd = process.cwd(), stdio = 'inherit' } = {}) {
  const binary = await locateEngine(environment);
  return new Promise((resolve, reject) => {
    // Forward arguments exactly. Keep the caller's directory so manifest paths work.
    const child = spawn(binary, args.length ? args : ['--help'], { cwd, env: environment, stdio, shell: false, windowsHide: true });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const cleanup = () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => { cleanup(); resolve(code ?? (signal === 'SIGINT' ? 130 : 1)); });
  });
}
