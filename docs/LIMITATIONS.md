# Limitations

`clonecheck` is intentionally lightweight and zero-dependency. The following boundaries apply:

1. **Static Specifiers**: Dynamic expressions such as `import(variable)` or `require(prefix + name)` cannot be resolved statically.
2. **Path Aliasing**: Only standard relative paths (`./`, `../`) and `package.json` `"imports"` subpath aliases are resolved. Tool-specific aliases (e.g. `tsconfig.json` `paths`, Webpack aliases, Vite aliases) are out of scope.
3. **Non-JavaScript Files**: Only JavaScript and TypeScript module files (`.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx`, `.json`) are scanned for imports.
4. **Build Outputs**: Pre-build source code importing generated files (like `dist/`) should configure those patterns in `generated: ["dist/**"]` to avoid false-positive errors before the build step runs.
