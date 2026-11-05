# Contributing

Use Node.js 22 or newer. Install with `npm ci --ignore-scripts`, then run `npm test`.

Keep input bundles unmodified. Preserve third-party notices. Add behavioral tests for transformation changes and filesystem tests for packaging changes. Avoid tests that merely assert implementation details.

Document size and runtime costs. Do not present minification, decoy volume, or hash verification as proof that software cannot be copied. Update the README and changelog when public behavior changes.

Do not commit credentials, application secrets, node_modules, generated releases, or private customer bundles.
