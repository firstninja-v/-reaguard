# Release preparation

The public repository is https://github.com/firstninja-v/-reaguard. The command and package name are `reaguard`.

## Validation

```sh
npm ci --ignore-scripts
npm test
node src/cli.js --help
```

Build the example into a fresh directory, execute the documented before/after example, and run `verify`. Run the full GitHub Actions matrix before tagging a release. Local tests are not a substitute for successful remote CI.

Before shipping a protected application, run its own tests against output. Retain trusted manifests privately or authenticate them separately. Measure startup time and size overhead with representative bundles.

## Publishing

Update the changelog and version together. Include third-party notices when distributing dependencies. Source is MIT-licensed. The package is intentionally blocked from npm publication by `private: true`; no registry package is promised.

Suggested topics: `javascript`, `nodejs`, `build-tools`, `minification`, `software-protection`, `reproducible-builds`.

Keep launch claims tied to measured behavior. Do not advertise an anti-cloning success rate without a reproducible benchmark.
