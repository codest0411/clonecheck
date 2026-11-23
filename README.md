# clonecheck

Statically detect imports and references to gitignored or untracked files before commit and CI.

## Problem

Code often imports or references files that exist on the developer's workstation but are gitignored or never committed. Everything works locally; a fresh clone, CI run, or teammate's environment then crashes with module resolution errors:

```text
Error: Cannot find module './secret-config.js'
```

Existing linters (`import/no-unresolved`) resolve against the local filesystem, giving zero errors if the file exists on disk. `clonecheck` compares what your code references against what Git actually tracks (`git ls-files`) and ignores (`git check-ignore`).

## Quick Start

Run directly in any Git repository:

```sh
npx clonecheck
```

Or pass a specific folder:

```sh
npx clonecheck ./packages/frontend
```

## Before & After Example

### Before
```javascript
// src/auth.js
import { secretKey } from './secret-key.js'; // secret-key.js is in .gitignore!
import { helper } from './LocalHelper.js';  // Git index has 'localhelper.js' (case mismatch)
```
- Local machine: passes tests and builds cleanly.
- CI / Fresh Clone: breaks immediately with `Cannot find module`.

### With clonecheck
```text
=== clonecheck audit report ===

[ERROR] Import of gitignored file (CC001)
        File:     src/auth.js:2:1
        Evidence: "./secret-key.js" resolves to gitignored "src/secret-key.js".
        Why:      A fresh clone or CI runner will not have this file.
        Fix:      Remove the file from .gitignore and track it, or avoid importing it.

[ERROR] Path casing mismatches Git index (CC004)
        File:     src/auth.js:3:1
        Evidence: Resolved "src/LocalHelper.js" on disk, but Git index tracks "src/localhelper.js".
        Why:      Fails on case-sensitive Linux CI runners.
        Fix:      Adjust import specifier casing to match "src/localhelper.js" exactly.
```

## Rules Reference

| Rule ID | Severity | Name | Description |
|---|---|---|---|
| CC001 | Error | Import of Gitignored File | Relative import resolves to a file matched by `.gitignore` |
| CC002 | Error | Import of Untracked File | Relative import resolves to an untracked file on disk |
| CC003 | Error | Import of Missing File | Relative import resolves to nonexistent path |
| CC004 | Error | Case Mismatch | Path resolves on disk but casing differs from Git index |
| CC005 | Error | Manifest Target Untracked | `main`, `types`, `bin`, or `exports` not tracked in Git |
| CC006 | Warning | Untracked Script Call | npm script runs an untracked or gitignored script |

## Ignoring Specific Lines

Use `// clonecheck-ignore-next-line` immediately before any import statement to suppress diagnostics:

```javascript
// clonecheck-ignore-next-line
import localConfig from './local-override.json';
```

## Configuration (`.clonecheckrc.json`)

Configure custom behavior via `.clonecheckrc.json` in your repository root:

```json
{
  "ignore": ["legacy/**"],
  "generated": ["dist/**", "build/**"],
  "failOn": "error",
  "rules": {
    "CC006": "off"
  }
}
```

### Build Outputs (`generated`)
Files matched by `generated` patterns are downgraded from `error` to `info`, acknowledging that build outputs (such as `dist/**`) will be created during the build step before tests execute.

## Pre-commit & CI Recipes

### Plain Git Hook (`.git/hooks/pre-commit`)
```sh
#!/bin/sh
npx clonecheck
```

### Husky (`.husky/pre-commit`)
```sh
npx clonecheck
```

### Lefthook (`lefthook.yml`)
```yaml
pre-commit:
  commands:
    clonecheck:
      run: npx clonecheck
```

### GitHub Actions (`.github/workflows/ci.yml`)
```yaml
- name: Run clonecheck
  run: npx clonecheck --format github
```

## Comparison With Other Tools

| Capability | clonecheck | knip | unimported | eslint-plugin-import |
|---|---|---|---|---|
| Checks Git index tracking (`git ls-files`) | Yes | No | No | No |
| Checks `.gitignore` match (`git check-ignore`) | Yes | No | No | No |
| Detects case mismatch against Git index | Yes | No | No | No |
| Validates package manifest targets | Yes | Partial | No | No |
| Validates npm scripts script files | Yes | No | No | No |
| Zero runtime dependencies | Yes | No | No | No |

## Limitations

- **Dynamic imports**: Dynamic variable expressions (e.g. `import(path)`) cannot be statically resolved.
- **Path aliases**: Only relative paths (`./`, `../`) and `package.json` `"imports"` subpath mappings are supported. TypeScript `paths` or Webpack aliases are out of scope.
- **File types**: Scans JavaScript and TypeScript source files (`.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx`, `.json`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and guidelines.

## License

MIT
