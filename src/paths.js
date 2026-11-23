import path from 'node:path';
import fs from 'node:fs';

/**
 * Normalizes any filesystem path to a clean POSIX format with forward slashes.
 *
 * @param {string} p
 * @returns {string}
 */
export function toPosix(p) {
  if (typeof p !== 'string') return '';
  return p.replace(/\\/g, '/');
}

/**
 * Checks whether targetPath is strictly inside or equal to rootDir.
 * Prevents directory traversal attacks via '..' or symlinks.
 *
 * @param {string} rootDir
 * @param {string} targetPath
 * @returns {boolean}
 */
export function isInsideRoot(rootDir, targetPath) {
  const normalRoot = path.resolve(rootDir);
  const normalTarget = path.resolve(targetPath);

  if (normalTarget === normalRoot) return true;

  const rel = path.relative(normalRoot, normalTarget);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Checks if a real path escapes the repository root through symlinks.
 *
 * @param {string} rootDir
 * @param {string} targetPath
 * @returns {boolean} True if safe (inside root), false if escapes root
 */
export function isRealpathInsideRoot(rootDir, targetPath) {
  const normalRoot = path.resolve(rootDir);
  try {
    const realRoot = fs.realpathSync(normalRoot);
    const realTarget = fs.realpathSync(targetPath);
    const rel = path.relative(realRoot, realTarget);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    // If target does not exist, check lexical containment
    return isInsideRoot(rootDir, targetPath);
  }
}

/**
 * Matches a relative path against an array of glob-like patterns.
 * Supports simple wildcards (* and **).
 *
 * @param {string} relativePath POSIX path relative to root
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function matchesGlob(relativePath, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;

  const normalized = toPosix(relativePath).replace(/^\/+/, '');

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue;
    const cleanPattern = toPosix(pattern).replace(/^\/+/, '');

    if (cleanPattern === normalized) return true;

    // Convert simple glob to regex: ** matches any path, * matches within segment
    const escaped = cleanPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '§DOUBLESTAR§')
      .replace(/\*/g, '[^/]*')
      .replace(/§DOUBLESTAR§/g, '.*');

    const regex = new RegExp(`^${escaped}$`);
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
}
