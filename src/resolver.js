import fs from 'node:fs';
import path from 'node:path';
import { toPosix, isInsideRoot } from './paths.js';

const EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json'];

/**
 * Resolved reference target details.
 * @typedef {Object} ResolutionResult
 * @property {boolean} existsOnDisk
 * @property {string | null} resolvedRelPath POSIX path relative to gitRoot (exact case on disk)
 * @property {boolean} isTracked
 * @property {boolean} isIgnored
 * @property {boolean} isUntracked
 * @property {boolean} caseMismatch
 * @property {string | null} gitIndexPath Exact path as stored in Git index
 * @property {string | null} [ignorePattern] Pattern from .gitignore if ignored
 * @property {string | null} [ignoreSource] File defining the ignore pattern
 * @property {string | null} error Error message if resolution failed completely
 */

/**
 * Resolves a relative import specifier from an importing file.
 *
 * @param {string} gitRoot Absolute path to git root
 * @param {string} importingFileRel POSIX relative path of importing file
 * @param {string} specifier Raw import specifier (e.g. './util', '../config.json')
 * @param {import('./git.js').TrackedFilesInfo} trackedInfo
 * @param {Set<string>} untrackedFiles
 * @param {Map<string, { ignored: boolean, source?: string, pattern?: string }>} ignoredMap
 * @param {Record<string, any>} [packageJson]
 * @returns {ResolutionResult}
 */
export function resolveImport(
  gitRoot,
  importingFileRel,
  specifier,
  trackedInfo,
  untrackedFiles,
  ignoredMap,
  packageJson = {}
) {
  // Handle package.json imports (#subpath)
  let effectiveSpecifier = specifier;
  let baseDir = path.dirname(path.join(gitRoot, importingFileRel));

  if (specifier.startsWith('#') && packageJson.imports && typeof packageJson.imports === 'object') {
    const mapped = packageJson.imports[specifier];
    if (typeof mapped === 'string') {
      effectiveSpecifier = mapped;
      baseDir = gitRoot; // package.json subpath imports are relative to package root
    }
  }

  const candidateBase = path.resolve(baseDir, effectiveSpecifier);

  // Security check: ensure target does not escape gitRoot
  if (!isInsideRoot(gitRoot, candidateBase)) {
    return {
      existsOnDisk: false,
      resolvedRelPath: null,
      isTracked: false,
      isIgnored: false,
      isUntracked: false,
      caseMismatch: false,
      gitIndexPath: null,
      error: `Path escapes repository root: ${specifier}`
    };
  }

  // Candidate file paths to test
  const candidates = [];

  // Direct path
  candidates.push(candidateBase);

  // Try appending extensions if no extension or extension not in list
  for (const ext of EXTENSIONS) {
    candidates.push(candidateBase + ext);
  }

  // Try directory index files
  for (const ext of EXTENSIONS) {
    candidates.push(path.join(candidateBase, `index${ext}`));
  }

  let foundDiskPath = null;

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        foundDiskPath = candidate;
        break;
      }
    } catch {
      // ignore
    }
  }

  if (!foundDiskPath) {
    return {
      existsOnDisk: false,
      resolvedRelPath: toPosix(path.relative(gitRoot, candidateBase)),
      isTracked: false,
      isIgnored: false,
      isUntracked: false,
      caseMismatch: false,
      gitIndexPath: null,
      error: `File does not exist on disk: ${specifier}`
    };
  }

  // Compute resolved relative path in POSIX format
  const resolvedRel = toPosix(path.relative(gitRoot, foundDiskPath));
  const lowerRel = resolvedRel.toLowerCase();

  // Check Git tracking status
  const exactGitPath = trackedInfo.lowerToExactMap.get(lowerRel);
  const isTracked = exactGitPath !== undefined;

  // Case mismatch check:
  // If tracked, does disk/import casing differ from exact git index casing?
  let caseMismatch = false;
  if (isTracked && exactGitPath !== resolvedRel) {
    caseMismatch = true;
  }

  // Check if ignored in .gitignore
  const ignoreInfo = ignoredMap.get(resolvedRel);
  const isIgnored = ignoreInfo ? ignoreInfo.ignored : false;

  // Check if untracked
  const isUntracked = untrackedFiles.has(resolvedRel) && !isIgnored;

  return {
    existsOnDisk: true,
    resolvedRelPath: resolvedRel,
    isTracked,
    isIgnored,
    isUntracked,
    caseMismatch,
    gitIndexPath: exactGitPath || null,
    ignorePattern: ignoreInfo?.pattern || null,
    ignoreSource: ignoreInfo?.source || null,
    error: null
  };
}
