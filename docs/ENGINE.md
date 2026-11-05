# Full engine integration

REAguard includes the complete MIT-licensed toolkit from
`danihelenterprises/die-a-rea` at commit
`0d322552673309372f9937bc5f0c50641ed1514e`. Its code, adapters, runtime guard,
benchmarks, Docker assets, documentation and original license live in `engine/`.
Original namespaces, manifest filenames and protocol identifiers are retained for
compatibility; attribution is deliberate.

The engine's extensionless Node adapters are CommonJS. `engine/package.json`
establishes an explicit CommonJS boundary so the parent REAguard ES-module package
cannot break them. The initial integration test exposed that issue; the boundary
is covered by a Node regression test and the upstream Rust adapter suite.

## Build and invoke

Install a current stable Rust toolchain, run `npm ci --ignore-scripts`, then
`npm run engine:build` from the repository root. The launcher checks the release
binary first, then the debug binary. `REAGUARD_ENGINE_BIN` can select a trusted
custom build. Nothing is downloaded at runtime.

Run `node /absolute/path/to/reaguard/src/cli.js engine --help`, or use `npm link`
and `reaguard engine --help`. Arguments, exit status and the caller's working
directory are forwarded; the bridge does not use a shell or reinterpret flags.
Run the engine from your application's project directory, not this toolkit's
checkout. The engine's own optional commands/adapters retain their upstream shell
semantics; the bridge does not sandbox them.

## Cautious JavaScript engine configuration

After `reaguard engine init --name my-app app.js`, review `die-a-rea.toml`.
For an initial test, use:

```toml
[project]
name = "my-app"

[policy]
profile = "low"

[randomization]
enabled = false

[tarpit]
enabled = false

[verify]
js_syntax = true

[[targets]]
path = "app.js"
```

Then run `reaguard engine plan`, `reaguard engine build --out release-1`, and
your actual application's tests against the result. Syntax checks alone do not
establish behavior. For self-contained UI bundles, the root parser-based JS lane
is the more conservative starting point.

## Adapters and advanced features

The original adapters, runtime library, Dockerfile and eval harness are included.
They are not all automatically enabled, installed or certified. Optional external
toolchains must be installed/configured as described in
[the upstream adapter guide](../engine/docs/ADAPTERS.md). The launcher deliberately
does not alter `PATH` or enable stronger transforms behind the user's back.

For POSIX hosts, the original executable adapter scripts can be selected using
`DIREA_<ID>_ADAPTER`. Windows users need executable adapter launchers appropriate
to their environment; copying a POSIX shebang script does not make it a Windows
executable. Use `doctor` to inspect availability and test the complete toolchain.

The inherited profiles, randomization, runtime guards, canaries and bounded
tarpits remain available. Their size/runtime costs and opt-in experimental
features are described in upstream documentation. Higher RRS is not evidence
that a real AI cloning attempt failed.

## Differences from the pinned snapshot

- Explicit CommonJS context for Node adapters.
- Conservative JS cleanup: preserve files with template delimiters, escapes or
  block comments; remove only standalone source-map directives when enabled.
  Keep recognized license comments and original line endings.
- Equivalent byte-string spelling compatible with current Clippy.

File hashes and patch inventory are checked by `npm run upstream:check`. Engine
documentation changes explain the patch without erasing upstream history.
