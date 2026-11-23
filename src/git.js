import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { toPosix } from './paths.js';

const GIT_TIMEOUT_MS = 20000;
const MAX_BUFFER_BYTES = 20 * 1024 * 1024;

/**
 * Checks if git CLI binary is available on PATH.
 *
 * @returns {boolean}
 */
export function isGitAvailable() {
  try {
    execFileSync('git', ['--version'], {
      stdio: 'ignore',
      timeout: 5000,
      shell: false
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the root directory of the enclosing Git repository.
 *
 * @param {string} cwd
 * @returns {string} Absolute path to Git root
 * @throws {Error} if not inside a git repository
 */
export function getGitRoot(cwd) {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      shell: false
    });
    return path.resolve(out.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Not inside a Git repository (or Git is unavailable): ${msg}`, { cause: err });
  }
}

/**
 * Information about tracked files in the Git index.
 * @typedef {Object} TrackedFilesInfo
 * @property {Set<string>} files Set of POSIX relative paths
 * @property {Map<string, string>} lowerToExactMap Lowercase path -> Exact Git index path
 */

/**
 * Retrieves all tracked files from the Git index.
 *
 * @param {string} gitRoot
 * @returns {TrackedFilesInfo}
 */
export function getTrackedFiles(gitRoot) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--stage'], {
      cwd: gitRoot,
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER_BYTES,
      timeout: GIT_TIMEOUT_MS,
      shell: false
    });

    const files = new Set();
    const lowerToExactMap = new Map();

    const entries = out.split('\0').filter(Boolean);
    for (const entry of entries) {
      // Format: <mode> SP <sha> SP <stage> TAB <path>
      const tabIdx = entry.indexOf('\t');
      if (tabIdx === -1) continue;
      const relPath = toPosix(entry.slice(tabIdx + 1));
      files.add(relPath);
      lowerToExactMap.set(relPath.toLowerCase(), relPath);
    }

    return { files, lowerToExactMap };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to list tracked files from Git: ${msg}`, { cause: err });
  }
}

/**
 * Retrieves all untracked (and unignored) files on disk.
 *
 * @param {string} gitRoot
 * @returns {Set<string>} Set of untracked POSIX relative paths
 */
export function getUntrackedFiles(gitRoot) {
  try {
    const out = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
      cwd: gitRoot,
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER_BYTES,
      timeout: GIT_TIMEOUT_MS,
      shell: false
    });

    const untracked = new Set();
    const entries = out.split('\0').filter(Boolean);
    for (const entry of entries) {
      untracked.add(toPosix(entry));
    }

    return untracked;
  } catch {
    return new Set();
  }
}

/**
 * Checks whether specific paths match .gitignore rules.
 * Uses `git check-ignore --verbose -z --stdin` with NUL delimiter.
 *
 * @param {string} gitRoot
 * @param {string[]} paths Relative POSIX paths to test
 * @returns {Map<string, { ignored: boolean, source?: string, pattern?: string }>}
 */
export function checkIgnoredPaths(gitRoot, paths) {
  const result = new Map();
  if (paths.length === 0) return result;

  const input = paths.map(p => toPosix(p)).join('\0') + '\0';

  try {
    const res = spawnSync('git', ['check-ignore', '--verbose', '-z', '--stdin'], {
      cwd: gitRoot,
      input,
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER_BYTES,
      timeout: GIT_TIMEOUT_MS,
      shell: false
    });

    if (res.stdout) {
      // Output format with --verbose -z:
      // <source>\0<lineno>\0<pattern>\0<pathname>\0
      const tokens = res.stdout.split('\0');
      for (let i = 0; i + 3 < tokens.length; i += 4) {
        const source = tokens[i];
        const pattern = tokens[i + 2];
        const pathname = toPosix(tokens[i + 3]);
        if (pathname) {
          result.set(pathname, {
            ignored: true,
            source,
            pattern
          });
        }
      }
    }
  } catch {
    // If git check-ignore fails, return empty map
  }

  return result;
}
