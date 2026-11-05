# Contributing

Use Node.js 22 or newer. Install with `npm ci --ignore-scripts` and run `npm test`. For browser changes, install browsers with `npx playwright install chromium firefox webkit`, then run `npm run test:browser`.

Keep input bundles unmodified. Preserve third-party notices. Transformation changes need original/output behavior comparisons, including completion values and reflection-sensitive names where relevant. Packaging changes need filesystem and failure-path tests. Browser tests must exercise interactions and compare output, not just parse JavaScript.

Document size/runtime costs and test limitations. Do not present decoy volume or hash verification as proof of anti-cloning effectiveness. Keep README, validation notes and changelog consistent with actual behavior.

Do not commit credentials, application secrets, node_modules, generated releases, browser binaries, test reports or private customer bundles.
