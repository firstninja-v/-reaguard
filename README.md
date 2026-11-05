# REAguard

**Add friction to AI-assisted reverse engineering.**

[![Tests](https://github.com/firstninja-v/-reaguard/actions/workflows/test.yml/badge.svg)](https://github.com/firstninja-v/-reaguard/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Minify your JavaScript. Add bounded synthetic decoys. Verify what you ship.

A small JavaScript release packager with reproducible minification, optional synthetic data, and SHA-256 integrity reports. Written as a standalone implementation. Requires Node.js 22 or newer.

Status: **0.1.0 — initial implementation.** Supports JavaScript bundles, CommonJS and ES modules. Anti-cloning effectiveness has not been benchmarked.

## Run

```sh
git clone https://github.com/firstninja-v/-reaguard.git reaguard
cd reaguard
npm ci
npm test
node src/cli.js plan examples/calculator.cjs --decoys 64
node src/cli.js build examples/calculator.cjs --out release-demo --seed release-001 --decoys 64
node src/cli.js verify release-demo
```

Compare the sample before and after packaging:

```sh
node -e "console.log(require('./examples/calculator.cjs').total([{price:19.95,quantity:3}],0.1))"
node -e "console.log(require('./release-demo/calculator.cjs').total([{price:19.95,quantity:3}],0.1))"
```

Both print `53.86`. Verification reports `"valid": true`. Use your own application tests for real releases.

Supply a **self-contained bundle**, not a project entry point with relative dependencies. This tool does not bundle imports or copy assets. `.mjs` enables module parsing automatically; pass `--module` for ESM `.js`. Preserve your application's package type when deploying `.js`.

`build` requires a nonexistent output directory whose parent exists. It never overwrites an existing release. `plan` validates input and options without writing files; it does not parse or transform the code. JSON errors and unsuccessful integrity checks exit with status 1.

## What ships

- A minified artifact with local identifiers shortened; public property names and function/class names remain intact.
- License and preservation comments retained. Ordinary comments and source-map directives removed by the parser/printer, not regex rewriting.
- Optional deterministic synthetic records appended as a discarded literal. Default: zero. Maximum: 4,096 records, additionally limited by `--max-growth` (default 262,144 bytes; maximum 1 MiB).
- A reproducible `manifest.json` containing hashes, options and measured byte counts, without source filesystem paths or timestamps.

## CLI reference

| Command or option | Meaning | Default |
| --- | --- | --- |
| `plan <file>` | Validate file type, size, and configuration; write nothing | — |
| `build <file> --out <directory>` | Transform into a new release directory | — |
| `verify <directory>` | Check artifact hash against its manifest | — |
| `--seed <text>` | Reproducible synthetic-data seed, 1–256 characters | `release` |
| `--decoys <number>` | Synthetic records, integer 0–4096 | `0` |
| `--max-growth <bytes>` | Budget for appended synthetic data, integer 0–1048576 | `262144` |
| `--module` | Parse `.js` input as an ES module | Off; automatic for `.mjs` |
| `--help` | Show usage | — |

Inputs are limited to 16 MiB. `--max-growth` limits the appended data, not total output size. The seed is not a password or encryption key. To use the installed command locally, run `npm link` and then `reaguard --help`; direct `node src/cli.js` invocation needs no linking.

## Repository layout

```text
src/core.js                 Transform, packaging, and integrity checks
src/cli.js                  Command-line interface
test/core.test.js           Behavioral and filesystem tests
examples/calculator.cjs     Runnable input fixture
.github/workflows/test.yml  Windows/Linux CI configuration
docs/ARCHITECTURE.md        Design and trust boundaries
docs/RELEASE.md             Release and publishing checklist
CHANGELOG.md                Version history
SECURITY.md                 Vulnerability reporting guidance
CONTRIBUTING.md             Development conventions
```

Synthetic records add static noise without I/O, global variables, debugger checks, network calls, or instructions to analysis agents. They do increase parsing time and file size. A capable analyst can identify and remove them. The manifest deliberately documents their size; omit the manifest from public delivery if it is only needed in your private release pipeline.

## Protection limits

This is an initial JavaScript implementation, not a universal binary protector. Minification and synthetic records do not prevent cloning or conceal secrets. Keep proprietary decision logic and credentials on a controlled server when practical. REAguard itself is open source so its techniques and limitations can be inspected.

Integrity verification detects changes relative to the manifest. It is **not authentication**: an attacker who can replace both files can recompute hashes. Keep manifests in trusted CI storage or sign release hashes separately.

Run your own application tests against packaged output before deployment. Reflection on function source, stack traces, source locations, and code that depends on exact formatting can change under minification. Do not process signed artifacts without re-signing. No resistance score or performance advantage is claimed without a measured benchmark.

## Development

```sh
npm ci
npm test
```

Tests cover CommonJS behavior, ES module exports, deterministic output, byte budgets, license comments, path traversal, tampering, dry runs, and overwrite protection. CI is configured for Linux and Windows with Node 22 and 24; local validation is distinct from a completed GitHub Actions run.

## Dependencies and distribution

Dependencies are locked. Terser performs parsing and minification; its license and the licenses of its dependencies remain applicable. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

REAguard is available under the [MIT license](LICENSE). `private: true` prevents accidental npm publication; the GitHub source is public. Install from this repository using the commands above.

## Help shape the project

Contribute compatibility tests, startup-time benchmarks, or reproducible measurements of analysis effort. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [roadmap](ROADMAP.md).

[Open an issue](https://github.com/firstninja-v/-reaguard/issues) with a minimal synthetic reproduction. If the project helps your workflow, a star helps others discover it.
