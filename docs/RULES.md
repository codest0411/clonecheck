# clonecheck Rule Catalog

This catalog documents all diagnostic rules evaluated by `clonecheck`.

## CC001: Import of Gitignored File
- **Severity**: Error (downgraded to Info if path matches `generated` config)
- **Description**: A source file imports, requires, or exports from a relative path that matches `.gitignore` rules via `git check-ignore`.
- **Why It Matters**: The imported file will not exist when cloned fresh or executed in CI.
- **Fix**: Remove the file from `.gitignore` and commit it, or remove the import statement.

## CC002: Import of Untracked File
- **Severity**: Error (downgraded to Info if path matches `generated` config)
- **Description**: A relative import resolves to a file on disk that is not tracked by Git (`git ls-files --others`).
- **Why It Matters**: The code works on the author machine but breaks in CI or for collaborators.
- **Fix**: Stage and commit the file using `git add <file>`.

## CC003: Import of Missing File
- **Severity**: Error
- **Description**: A relative import cannot be resolved to any file on disk.
- **Why It Matters**: Runtime or bundler resolution failure.
- **Fix**: Correct the path spelling, fix the extension, or create the file.

## CC004: Path Casing Mismatches Git Index
- **Severity**: Error
- **Description**: The import resolves on disk because the filesystem is case-insensitive (e.g. macOS, Windows), but the casing differs from the path stored in the Git index.
- **Why It Matters**: Fails immediately on case-sensitive filesystems like Linux CI or production containers.
- **Fix**: Adjust import casing to match Git index casing exactly.

## CC005: Package Manifest Target Untracked or Missing
- **Severity**: Error
- **Description**: Fields `main`, `module`, `types`, `bin`, or `exports` in `package.json` point to files that are missing from disk, gitignored, untracked, or omitted from npm publish.
- **Why It Matters**: Installing the package breaks consumers because entry points cannot be loaded.
- **Fix**: Ensure the entry point is tracked in git and included in the `files` array.

## CC006: npm Script References Untracked or Ignored File
- **Severity**: Warning
- **Description**: An npm script command executes a local script file that is not committed to Git or is gitignored.
- **Why It Matters**: Collaborators running `npm run <script>` will fail.
- **Fix**: Commit the script file or adjust the npm script definition.
