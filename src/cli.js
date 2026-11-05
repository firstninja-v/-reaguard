#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { build, plan, verify, VERSION } from './core.js';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, seed: { type: 'string' }, decoys: { type: 'string' },
    'max-growth': { type: 'string' }, module: { type: 'boolean' }, mangle: { type: 'boolean' },
    'allow-external': { type: 'boolean' }, check: { type: 'string' },
    help: { type: 'boolean' }, version: { type: 'boolean' }
  } });
  const [command, target] = positionals;
  if (values.version) console.log(VERSION);
  else if (values.help || !command) {
    console.log('REAguard\n  plan <bundle.js> [--decoys N] [--seed TEXT] [--module] [--mangle]\n  build <bundle.js> --out <new-directory> [--decoys N] [--seed TEXT] [--max-growth BYTES] [--module] [--mangle] [--allow-external] [--check JSON_ARGV]\n  verify <release-directory>\nDefault: no compression, identifier renaming, or synthetic data.\nBuilds parse output but do not run your app unless --check is supplied.\nInput must be a self-contained bundle. Results and errors are JSON.');
  } else {
    if (positionals.length !== 2) throw new Error('Provide exactly one target');
    if (!['plan', 'build', 'verify'].includes(command)) throw new Error(`Unknown command: ${command}`);
    const allowed = command === 'verify' ? [] : command === 'plan' ? ['seed', 'decoys', 'max-growth', 'module', 'mangle', 'allow-external'] : ['out', 'seed', 'decoys', 'max-growth', 'module', 'mangle', 'allow-external', 'check'];
    for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`--${key} is not supported by ${command}`);
    const config = {};
    for (const [key, value] of Object.entries(values)) {
      const targetKey = { 'max-growth': 'maxGrowth', 'allow-external': 'allowExternal' }[key] ?? key;
      if (['out', 'check'].includes(key)) continue;
      if (['decoys', 'max-growth'].includes(key) && !/^\d+$/.test(value)) throw new Error(`--${key} must be a nonnegative integer`);
      config[targetKey] = ['decoys', 'max-growth'].includes(key) ? Number(value) : value;
    }
    let result;
    if (command === 'plan') result = await plan(target, config);
    else if (command === 'build') {
      if (!values.out) throw new Error('--out is required');
      result = await build(target, values.out, config, values.check ? JSON.parse(values.check) : undefined);
    } else {
      result = await verify(target);
      if (!result.valid) process.exitCode = 1;
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
