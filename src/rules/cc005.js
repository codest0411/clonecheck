import path from 'node:path';
import fs from 'node:fs';
import { toPosix, isInsideRoot, matchesGlob } from '../paths.js';

/**
 * Rule CC005: package.json manifest targets (main, module, types, bin, exports)
 * that are not tracked in Git.
 *
 * @param {string} gitRoot
 * @param {Record<string, any>} packageJson
 * @param {import('../git.js').TrackedFilesInfo} trackedInfo
 * @param {Map<string, { ignored: boolean }>} ignoredMap
 * @param {string[]} [packFiles] Optional list of files npm pack would publish
 * @param {string[]} [generated=[]] Optional list of generated file glob patterns
 * @returns {import('./index.js').Finding[]}
 */
export function checkCC005(gitRoot, packageJson, trackedInfo, ignoredMap, packFiles, generated = []) {
  /** @type {import('./index.js').Finding[]} */
  const findings = [];
  if (!packageJson || typeof packageJson !== 'object') return findings;

  const targets = [];

  // 1. main, module, types
  if (typeof packageJson.main === 'string') targets.push({ field: 'main', target: packageJson.main });
  if (typeof packageJson.module === 'string') targets.push({ field: 'module', target: packageJson.module });
  if (typeof packageJson.types === 'string') targets.push({ field: 'types', target: packageJson.types });
  if (typeof packageJson.typings === 'string') targets.push({ field: 'typings', target: packageJson.typings });

  // 2. bin
  if (typeof packageJson.bin === 'string') {
    targets.push({ field: 'bin', target: packageJson.bin });
  } else if (packageJson.bin && typeof packageJson.bin === 'object') {
    for (const [cmd, binPath] of Object.entries(packageJson.bin)) {
      if (typeof binPath === 'string') {
        targets.push({ field: `bin.${cmd}`, target: binPath });
      }
    }
  }

  // 3. exports
  if (typeof packageJson.exports === 'string') {
    targets.push({ field: 'exports', target: packageJson.exports });
  } else if (packageJson.exports && typeof packageJson.exports === 'object') {
    collectExportTargets(packageJson.exports, 'exports', targets);
  }

  const packSet = packFiles ? new Set(packFiles.map(p => toPosix(p))) : null;

  for (const item of targets) {
    const rawTarget = item.target;
    if (!rawTarget || typeof rawTarget !== 'string') continue;

    const absPath = path.resolve(gitRoot, rawTarget);
    if (!isInsideRoot(gitRoot, absPath)) continue;

    const relPath = toPosix(path.relative(gitRoot, absPath));
    const lowerRel = relPath.toLowerCase();
    const isTracked = trackedInfo.lowerToExactMap.has(lowerRel);
    const exists = fs.existsSync(absPath);
    const isIgnored = ignoredMap.get(relPath)?.ignored || false;
    const isGenerated = Array.isArray(generated) && matchesGlob(relPath, generated);
    const severity = isGenerated ? /** @type {'info'} */ ('info') : /** @type {'error'} */ ('error');

    // In pack mode, check if in published tarball
    if (packSet && !packSet.has(relPath)) {
      findings.push({
        id: 'CC005',
        severity: 'error',
        file: 'package.json',
        line: 1,
        column: 1,
        title: `Package target not in publish tarball (${item.field})`,
        evidence: `Field "${item.field}" points to "${rawTarget}" which is omitted from npm publish files.`,
        whyItMatters: 'Consumers installing your package from npm will receive a broken package missing its entry point.',
        fixAdvice: `Add "${rawTarget}" to the "files" array in package.json.`
      });
      continue;
    }

    if (!exists) {
      findings.push({
        id: 'CC005',
        severity,
        file: 'package.json',
        line: 1,
        column: 1,
        title: isGenerated ? `Package target is generated build artifact (${item.field})` : `Package target does not exist on disk (${item.field})`,
        evidence: `Field "${item.field}" points to "${rawTarget}" which does not exist.`,
        whyItMatters: isGenerated
          ? 'Entry point is a generated build output and will be created during build.'
          : 'Importing or running this package fails because the declared entry point is missing.',
        fixAdvice: `Ensure the build generates "${rawTarget}" or update package.json.`
      });
    } else if (isIgnored) {
      findings.push({
        id: 'CC005',
        severity,
        file: 'package.json',
        line: 1,
        column: 1,
        title: isGenerated ? `Package target is generated build artifact (${item.field})` : `Package target is gitignored (${item.field})`,
        evidence: `Field "${item.field}" points to "${rawTarget}" which is matched by .gitignore.`,
        whyItMatters: isGenerated
          ? 'Entry point is a build artifact matched by .gitignore. Ensure build runs before packaging.'
          : 'If this file is not committed or not built before publishing, clones and releases will break.',
        fixAdvice: 'If this is a build output, ensure it is built in prepublish; otherwise track it in git.'
      });
    } else if (!isTracked) {
      findings.push({
        id: 'CC005',
        severity,
        file: 'package.json',
        line: 1,
        column: 1,
        title: isGenerated ? `Package target is generated build artifact (${item.field})` : `Package target is untracked (${item.field})`,
        evidence: `Field "${item.field}" points to "${rawTarget}" which is untracked in Git.`,
        whyItMatters: isGenerated
          ? 'Entry point is a build artifact not tracked in git.'
          : 'Fresh clones will be unable to import this entry point until it is tracked in Git.',
        fixAdvice: isGenerated
          ? 'Ensure prepublish build script generates this file.'
          : `Track the entry point in git with "git add ${relPath}".`
      });
    }
  }

  return findings;
}

/**
 * Recursively extracts export target string values.
 * @param {any} exp
 * @param {string} prefix
 * @param {Array<{ field: string, target: string }>} targets
 */
function collectExportTargets(exp, prefix, targets) {
  if (typeof exp === 'string') {
    targets.push({ field: prefix, target: exp });
  } else if (exp && typeof exp === 'object') {
    for (const [k, v] of Object.entries(exp)) {
      collectExportTargets(v, `${prefix}.${k}`, targets);
    }
  }
}
