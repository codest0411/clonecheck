# Changelog

All notable changes to `clonecheck` are documented in this file.

## [0.1.0] - 2026-11-23

### Added
- Static audit of tracked JavaScript/TypeScript files against Git index and `.gitignore`.
- Diagnostic rules CC001 through CC006 for untracked, gitignored, missing, and case-mismatched imports.
- Package manifest (`main`, `module`, `types`, `bin`, `exports`) and npm scripts tracking validation.
- Reporters for human terminal output, JSON, and GitHub Actions workflow commands.
- Configurable build output handling (`generated`) and rule severity overrides.
- TypeScript declaration files generated in `dist/`.
