# Architecture

REAguard has two explicit lanes. The `engine` subcommand launches the attributed Rust toolkit with unchanged arguments and working directory, without a shell. The Rust engine owns its manifest, adapters and RRS semantics. All other commands use the independent JS packaging lane described below. Upstream names and copyrights remain intentional. See [ENGINE.md](ENGINE.md).

# JavaScript lane architecture

REAguard processes one self-contained JavaScript bundle. It is not a site bundler or a native executable protector.

1. Validate typed options and file limits; reject input symlinks and malformed UTF-8.
2. Acorn parses input in explicit script/module mode. A conservative traversal identifies common external dependencies and location-sensitive constructs. Reject by default, or record warnings with an explicit override.
3. Terser prints compact code with compression disabled and identifier renaming off unless requested. License comments and names are retained.
4. Append optional deterministic records in a non-executable comment, subject to a byte budget. Parse the final output again.
5. Only after preflight succeeds, exclusively create the output directory. Write the artifact preserving permission bits, and package metadata specifying its Node module type.
6. Optionally run a trusted argument-array validation command without a shell, with a 30-second timeout. Reject modifications to artifact/package metadata by the check.
7. Write a version-2 manifest covering original bytes, artifact bytes, package metadata, configuration, warnings, metrics and validation status.

`plan` performs steps 1–4 without output writes. `verify` reads bounded regular files, validates the manifest path/digests and compares both output hashes. Version-1 manifests remain readable.

Reproducibility requires the same source bytes/basename, options, dependency versions and validation mode. Manifests contain no absolute input paths or timestamps. The optional validation command itself is not recorded, to avoid leaking local paths or command arguments.

Use a controlled workspace. Filesystem operations do not defend against another process racing to change paths. A custom check is arbitrary user-authorized execution, not a sandbox; it can spawn children or change other files. Timeout termination is best effort and does not guarantee termination of descendants. Failed builds unlink only files recorded as created, never recursively remove check-generated content.

Static inspection is intentionally conservative and can produce false positives for shadowed names. It cannot discover all aliased/dynamic dependencies. Syntax and hash checks do not establish runtime correctness, security or resistance to reverse engineering.
