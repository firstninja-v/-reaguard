# Architecture

REAguard operates on one prebuilt JavaScript bundle at a time.

1. Validate options, resolve the input, check file type and the 16 MiB size limit.
2. Reserve a new output directory. Existing directories are rejected.
3. Parse and print using the locked Terser version. Compression is disabled; local name mangling is enabled, with function and class names retained.
4. Generate optional records from SHA-256 of the seed and record index. Append a discarded array literal after minification, enforcing the configured byte budget.
5. Write the artifact and manifest with exclusive file creation.
6. Verify independently by reading the artifact and comparing its SHA-256 digest with the manifest.

Build output is reproducible for the same input bytes, basename, options and dependency versions. Manifests omit timestamps and absolute input paths. A failed build attempts cleanup of the files in its newly created output directory.

## Trust boundaries

Use a workspace you control. Filesystem operations do not provide a sandbox against another process concurrently changing files or directories. Builds parse input but do not execute application code. Syntax validity does not establish application correctness.

The manifest is unsigned. Verification establishes consistency with that manifest, not publisher identity. Source hashes are informational: verification does not require or compare the original source.

Synthetic records are distinguishable nonfunctional data. They neither encrypt logic nor block analysis tools. Do not use record count or output inflation as evidence of stronger protection.

## Current exclusions

No native executable transforms, dependency bundling, source-map generation, server-side licensing, runtime debugger guards, cryptographic signing, or prompt-injection payloads. Relative imports and assets must be handled by the application's own bundler and deployment process.
