# Changelog

## 0.3.0

- Import the full attributed Rust engine, adapters, runtime, benchmarks and documentation at a pinned upstream commit.
- Add `engine` command forwarding without shell interpolation and with preserved working directory/exit status.
- Preserve CommonJS scope for extensionless upstream adapters.
- Fix unsafe JavaScript line removal and honor source-map policy switches.
- Preserve executable permissions on rewritten Unix file targets.
- Fix source/output containment across filesystem aliases, including macOS temporary paths and Windows path prefixes.
- Add provenance/patch inventories, Rust CI, engine behavior/native smoke checks, and a generated README banner.
- Retain the conservative JS-only workflow and existing browser tests.

## 0.2.0

Compatibility-focused release; no anti-cloning effectiveness claim.

- Disable identifier renaming by default; opt in using `--mangle`.
- Replace executable decoy arrays with comments to preserve completion values and avoid runtime allocations.
- Parse input/output and perform dependency/location preflight before creating a release.
- Make `plan` perform real transformation and exact size estimation.
- Record explicit module type in generated package metadata; include it in integrity verification.
- Add optional shell-free, timed application checks and explicit validation status.
- Reject invalid UTF-8, symlinks, unsupported CLI options and malformed manifest digests.
- Preserve shebangs and source executable permissions.
- Expand Node regression tests and add cross-browser behavioral/pixel parity tests.
- Document deployment requirements for chunks, assets, SRI, CSP and service workers.

## 0.1.0

Initial JavaScript CLI, deterministic synthetic data, integrity manifests and eight tests. Superseded by 0.2.0 compatibility fixes.
