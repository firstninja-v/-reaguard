#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { build, plan, verify } from './core.js';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, seed: { type: 'string', default: 'release' },
    decoys: { type: 'string', default: '0' }, 'max-growth': { type: 'string', default: '262144' },
    module: { type: 'boolean', default: false }, help: { type: 'boolean', default: false }
  } });
  const [command, target] = positionals;
  if (values.help || !command) {
    console.log('REAguard\n  plan <bundle.js> [--decoys N] [--seed TEXT] [--module]\n  build <bundle.js> --out <new-directory> [--decoys N] [--seed TEXT] [--max-growth BYTES] [--module]\n  verify <release-directory>\nAll results are JSON. Input must be a self-contained bundle.');
  } else {
    if (positionals.length !== 2) throw new Error('Provide exactly one target');
    const config = { seed: values.seed, decoys: Number(values.decoys), maxGrowth: Number(values['max-growth']), module: values.module };
    let result;
    if (command === 'plan') result = await plan(target, config);
    else if (command === 'build') {
      if (!values.out) throw new Error('--out is required');
      result = await build(target, values.out, config);
    } else if (command === 'verify') {
      result = await verify(target);
      if (!result.valid) process.exitCode = 1;
    } else throw new Error(`Unknown command: ${command}`);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
