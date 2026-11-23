# Competitor Analysis: Detecting References to Gitignored or Untracked Files

## Problem Definition
Developers frequently import or reference local files (e.g. secret configs, generated mock data, local utility scripts) that exist on their local filesystem but are gitignored or not yet tracked in git.
Because the file exists on disk, local unit tests, linters, and bundlers succeed on the author's machine. However, as soon as code is pushed to CI or cloned by a collaborator, the build or tests crash with module resolution errors.

`clonecheck` specifically audits tracked source files against the Git tracked/staged file set and `.gitignore` rules before commit or release.

## Evaluated Tools

### 1. `knip`
- **Link**: https://github.com/webpro-nl/knip
- **What it does**: Scans projects for unused files, unused dependencies in `package.json`, and unused exported variables/types. Automatically skips `.gitignore` patterns so it does not report build artifacts as unused.
- **What it does NOT do**: It does NOT flag when tracked source files import gitignored or untracked local files. If a tracked file imports `./secret-config.js` which is gitignored, Knip ignores `./secret-config.js` and does not raise an alert.

### 2. `unimported`
- **Link**: https://github.com/smeijer/unimported
- **What it does**: Scans starting from entry points to identify dangling source files that exist in the repository but are never imported by any entry point.
- **What it does NOT do**: It does not compare imported module paths against Git tracking state or `.gitignore`. If an import resolves to an untracked or ignored file on disk, `unimported` considers it resolved.

### 3. `dependency-cruiser`
- **Link**: https://github.com/sverweij/dependency-cruiser
- **What it does**: Validates and visualizes module dependencies against architectural rules (e.g., preventing circular dependencies or banning imports from UI to DB modules).
- **What it does NOT do**: Relies on filesystem resolution. It does not inspect Git index state (`git ls-files`) or Git ignore state (`git check-ignore`).

### 4. `eslint-plugin-import` (`import/no-unresolved`)
- **Link**: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-unresolved.md
- **What it does**: Verifies that imported paths resolve to an actual file on disk or an installed package in `node_modules`.
- **What it does NOT do**: As long as the file exists on the developer's disk, `import/no-unresolved` reports zero errors, even if the file is ignored by `.gitignore` or completely untracked in Git.

### 5. `check-imports`
- **Link**: https://github.com/inversify/check-imports
- **What it does**: Validates whether imported dependencies match declarations in `package.json`.
- **What it does NOT do**: Does not check Git index tracking status or filesystem ignore status.

## Differentiation
Unlike general dependency linters or dead-code detectors that evaluate paths against the local filesystem, `clonecheck` validates imports specifically against the *Git index* (`git ls-files`) and *Git ignore patterns* (`git check-ignore`). It simulates what a fresh `git clone` environment will see before code leaves the developer's workstation, catching untracked and gitignored relative imports, case-insensitivity traps on Windows/macOS, broken package manifest targets, and untracked npm script files.
