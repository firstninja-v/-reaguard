# REAguard

**JavaScript release hardening with compatibility checks.**

[![Tests](https://github.com/firstninja-v/-reaguard/actions/workflows/test.yml/badge.svg)](https://github.com/firstninja-v/-reaguard/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Minify a bundle. Preview the changes. Test the result. Verify what you ship.

The complete MIT-licensed upstream Rust toolkit is now included under
[`engine/`](engine/README.md), pinned and attributed in [UPSTREAM.json](UPSTREAM.json)
and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Integration work is in progress;
the JavaScript workflow below remains available.

**0.2.0 — experimental, JavaScript only.** REAguard reduces readable formatting and can optionally rename local identifiers or add synthetic comments. It has **not** demonstrated resistance to AI cloning. It is not a replacement for a multi-platform obfuscator, access control, or keeping secrets on a server.

## Quick start

Requires Node.js 22 or newer. Start with the included fixture, not your live deployment.

```sh
git clone https://github.com/firstninja-v/-reaguard.git reaguard
cd reaguard
npm ci --ignore-scripts
npm test
node src/cli.js plan examples/calculator.cjs
node src/cli.js build examples/calculator.cjs --out release-demo
node src/cli.js verify release-demo
```

Compare behavior:

```sh
node -e "console.log(require('./examples/calculator.cjs').total([{price:19.95,quantity:3}],0.1))"
node -e "console.log(require('./release-demo/calculator.cjs').total([{price:19.95,quantity:3}],0.1))"
```

Both print `53.86`. Verification reports `"valid": true`. Each build needs a **new output directory** whose parent exists. Rerunning with the same directory fails rather than replacing it.

## Will it change my code or UI?

REAguard does not write to the input bundle. It writes a separate artifact, `package.json`, and `manifest.json`. It does not edit HTML, CSS, images, or your source repository.

The output JavaScript is reformatted. **No transform can promise compatibility with every application.** By default, compression and identifier renaming are disabled; function/class names, properties, and license comments are retained. Both input and final output are parsed. Optional synthetic data is a comment, so it creates no runtime array, global variables, calls, or changed evaluation result.

We test a browser fixture before and after transformation, comparing rendered pixels, DOM state, styles, click and keyboard behavior, forms, Unicode text, and local storage. The tests cover classic scripts and modules with renaming on/off in Chromium, Firefox, and WebKit. These tests do not establish compatibility with your app or every framework.

### Safe deployment workflow

1. Produce a **self-contained JavaScript bundle** with your existing build system. REAguard does not bundle dependencies or copy assets.
2. Run `plan`. It performs the full parse/transform preflight and reports exact byte counts without writing anything.
3. Build to a new directory. Test that output with your application's existing tests before deployment.
4. Deploy using your existing asset pipeline. Recompute content hashes, SRI attributes and CSP hashes where applicable; preserve chunk paths, cache manifests and service-worker entries. REAguard does not update those references.
5. Keep the original release for rollback. Verify the packaged artifact against a trusted manifest.

Imports, non-built-in `require` calls, dynamic imports, `import.meta`, Node location variables and common resource-loading constructs are rejected by default. This is a conservative syntax scan, not complete dependency analysis: aliases, framework loaders, string-generated paths and custom loaders can evade it. `--allow-external` bypasses those checks only when you have verified deployment paths yourself; warnings remain in the report.

`.mjs` uses module mode; `.cjs` uses CommonJS. For ESM `.js`, pass `--module` explicitly. The generated package metadata records the selected mode so Node does not inherit a different type at the output location. Browser deployment must retain the correct `<script type="module">` attribute.

### Optional application check

`--check` accepts a JSON array of executable and arguments, runs without a shell in the output directory, and must exit successfully within 30 seconds. `{artifact}` and `{out}` expand to absolute paths. The check can run arbitrary code: use a check you trust. Failed checks remove generated files where possible; unrelated files produced by a check are left intact.

POSIX shell / PowerShell example:

```sh
node src/cli.js build examples/calculator.cjs --out release-checked --check '["node","--check","{artifact}"]'
```

This example is a Node syntax check, **not an application behavior test**. Substitute your actual test executable and arguments. Without `--check`, the manifest explicitly records `applicationCheck: "not-run"`. A successful custom check is recorded as `passed`; REAguard does not assess its test coverage.

## Options

| Command / option | Behavior | Default |
| --- | --- | --- |
| `plan <file>` | Full preflight and size estimate; no writes | — |
| `build <file> --out <directory>` | Write a new release | — |
| `verify <directory>` | Check artifact and generated package metadata hashes | — |
| `--mangle` | Opt into local identifier renaming | Off |
| `--module` | ES module semantics for `.js` | Off; automatic for `.mjs` |
| `--decoys N` | Append 0–4096 synthetic records in a comment | `0` |
| `--seed TEXT` | Deterministic seed, 1–256 characters | `release` |
| `--max-growth BYTES` | Synthetic-comment budget, 0–1048576 bytes | `262144` |
| `--allow-external` | Acknowledge and bypass dependency/path warnings | Off |
| `--check JSON_ARGV` | Run a trusted validation command after writing | Not run |
| `--version` / `--help` | Version / usage | — |

Inputs must be valid UTF-8, regular files up to 16 MiB; symlinks are rejected. Build errors and failed verification exit with status 1. Results and errors are JSON. Options not applicable to a command are rejected.

`--mangle` can affect parameter-name reflection and dependency injection; test before enabling it. Formatting changes affect function source strings, stack locations, signatures and checksums even with renaming disabled. Existing source maps are not regenerated. Preserve required third-party notices when deploying.

## Dummy data: experiment, not a security boundary

```sh
node src/cli.js build examples/calculator.cjs --out release-experiment --decoys 64 --seed demo
```

Synthetic records are deliberately non-executable and explicitly labeled. They increase download size and parsing/scanning work, and can be trivially stripped. They do not encrypt logic or prove resistance to copying. We removed executable dummy arrays because they changed JavaScript completion values and added unnecessary runtime work. No prompt injection or debugger traps are inserted.

## Verification limits

SHA-256 checks establish consistency with an **unsigned manifest**, not publisher identity or application correctness. An attacker able to replace both files can recompute the hashes. Keep manifests in trusted storage or authenticate them separately. Legacy version-1 manifests remain readable but do not cover package metadata.

## Development and evidence

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium firefox webkit
npm run test:browser
```

See [VALIDATION.md](docs/VALIDATION.md) for the tested scope and exclusions. CI runs Node tests on Windows/Linux and Node 22/24, plus browser tests on Linux. A green CI badge is compatibility evidence for the fixtures, not a protection score.

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](ROADMAP.md) and [contributing](CONTRIBUTING.md)
- [Security reporting](SECURITY.md)
- [Release checklist](docs/RELEASE.md)

## License and dependencies

[MIT](LICENSE). Terser handles printing/minification; Acorn handles syntax and preflight inspection. Playwright is a development dependency. See [third-party notices](THIRD_PARTY_NOTICES.md). The repository is public; `private: true` only prevents accidental npm publication.

Found a bug? [Open an issue](https://github.com/firstninja-v/-reaguard/issues) with a minimal synthetic reproduction. Useful contributions include framework fixtures and honest performance/analysis benchmarks.
