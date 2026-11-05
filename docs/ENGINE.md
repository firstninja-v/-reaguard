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
