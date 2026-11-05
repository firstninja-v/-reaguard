# Third-party dependencies

Runtime dependencies: Terser (BSD-2-Clause) for printing/minification and Acorn (MIT) for syntax/preflight inspection. Development dependency: Playwright Test (Apache-2.0) for browser testing. Exact direct and transitive versions are in `package-lock.json`.

Installed packages retain their license files. When redistributing dependencies or an executable containing them, include the applicable license texts; this inventory is not a substitute. Browser binaries are test tools, installed separately, and are not included in this repository.

The complete Rust toolkit in `engine/` is derived from
[danihelenterprises/die-a-rea](https://github.com/danihelenterprises/die-a-rea),
commit `0d322552673309372f9937bc5f0c50641ed1514e`.
Copyright (c) 2026 die-a-rea contributors. Its full MIT license is retained in
[engine/LICENSE](engine/LICENSE). The root MIT license covers REAguard's additions
and does not replace upstream copyright notices.

[UPSTREAM.json](UPSTREAM.json) records original file hashes and executable modes
for auditing the imported snapshot. Upstream documentation describes the imported
project; REAguard's root documentation describes this integration. No claim is made
that the upstream implementation, release hardening, or synthetic data was invented
by REAguard.
