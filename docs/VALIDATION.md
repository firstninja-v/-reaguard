# Validation scope — 0.2.0

This document records what is tested, not a promise that arbitrary applications are compatible.

## Node regression suite

`npm test` covers CommonJS/ESM behavior, regexes/templates, errors, names/arity, classes, async functions, evaluation completion values, deterministic releases, source-byte preservation, UTF-8 rejection, dependency preflight, output overwrite rejection, shell-free application checks, module metadata, tampering, traversal, executable permissions and CLI option validation.

The symlink regression can be skipped on Windows when the operating system denies unprivileged symlink creation. Linux CI is expected to run it; inspect CI results before a release.

## Browser suite

`npm run test:browser` compares original and transformed versions of one synthetic UI fixture. Each engine runs classic and module scripts, with identifier renaming off/on and 64 synthetic records. Assertions compare initial and final screenshots byte-for-byte within the same engine, DOM state, CSS colors, clicks, Enter-key activation, form submission, Unicode text, local storage and runtime errors.

Local Windows validation: all eight Chromium/WebKit cases passed. Firefox could not launch (`spawn UNKNOWN`), so no local Firefox compatibility result is claimed. The Linux CI browser job runs all three engines and is the source of remote results.

## Not established

- React/Vue/Angular/Next.js compatibility across versions, bundlers or deployment environments.
- Native executables, Python, mobile packages, source TypeScript or JSX.
- Correct relocation of multi-file apps, chunks, assets, runtime imports, worker scripts, service workers, SRI/CSP hashes or CDN caches.
- Protection against AI cloning, resistance to a skilled reverse engineer, or a measured security improvement over minification alone.
- Universal UI preservation, source-reflection compatibility, absence of every vulnerability, or zero overhead.

## Before a video or deployment

Show the included fixture and describe this as experimental JavaScript packaging. Demonstrate that the original is unchanged, execute the output, and show the manifest's application-check status. Do not describe a hash check as a behavior test or label synthetic data as encryption.

For a real product, use its own unit/integration/browser tests against the transformed release and its actual deployment configuration. A successful fixture demo is not a substitute.
