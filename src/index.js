import fs from 'node:fs';
import path from 'node:path';
import { isGitAvailable, getGitRoot, getTrackedFiles, getUntrackedFiles, checkIgnoredPaths } from './git.js';
import { loadConfig } from './config.js';
import { scanFile } from './scanner.js';
import { resolveImport } from './resolver.js';
import { checkCC001, checkCC002, checkCC003, checkCC004, checkCC005, checkCC006 } from './rules/index.js';
import { renderHuman, renderJson, renderGitHub } from './reporters/index.js';
import { toPosix, matchesGlob } from './paths.js';

const SCANNABLE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

/**
 * Audit options for clonecheck.
 * @typedef {Object} CheckOptions
 * @property {string} [path] Target path to check (default: process.cwd())
 * @property {string} [config] Path to custom .clonecheckrc.json
 * @property {'human' | 'json' | 'github'} [format='human']
 * @property {'error' | 'warning'} [failOn]
 * @property {string[]} [ignore] Glob patterns to ignore
 * @property {boolean} [pack=false] Check npm pack publish inclusions
 */

/**
 * Result of clonecheck audit.
 * @typedef {Object} CheckResult
 * @property {import('./rules/index.js').Finding[]} findings
 * @property {number} exitCode 0 if clean, 1 if issues found at or above failOn, 2 on runtime error
 * @property {string} output Formatted report string
 * @property {string} gitRoot Absolute path to git root
 */

/**
 * Programmatic entry point for clonecheck.
 *
 * @param {CheckOptions} [options={}]
 * @returns {CheckResult}
 */
export function check(options = {}) {
  const targetDir = path.resolve(options.path || process.cwd());

  if (!isGitAvailable()) {
    const errFinding = {
      id: 'CC000',
      severity: /** @type {'error'} */ ('error'),
      file: 'git',
      line: 1,
      column: 1,
      title: 'Git binary not found',
      evidence: 'The "git" command line tool is not available on PATH.',
      whyItMatters: 'clonecheck requires git to inspect the index and ignore patterns.',
      fixAdvice: 'Install Git or ensure git is added to PATH.'
    };
    return {
      findings: [errFinding],
      exitCode: 2,
      output: renderHuman([errFinding], targetDir),
      gitRoot: targetDir
    };
  }

  let gitRoot;
  try {
    gitRoot = getGitRoot(targetDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errFinding = {
      id: 'CC000',
      severity: /** @type {'error'} */ ('error'),
      file: '.',
      line: 1,
      column: 1,
      title: 'Not inside a Git repository',
      evidence: msg,
      whyItMatters: 'clonecheck validates code against Git tracking state.',
      fixAdvice: 'Initialize a git repository using "git init" or run inside a tracked repository.'
    };
    return {
      findings: [errFinding],
      exitCode: 2,
      output: renderHuman([errFinding], targetDir),
      gitRoot: targetDir
    };
  }

  const config = loadConfig(gitRoot, options.config);
  if (options.failOn) {
    config.failOn = options.failOn;
  }
  if (Array.isArray(options.ignore)) {
    config.ignore.push(...options.ignore);
  }

  // Read package.json if present
  /** @type {Record<string, any>} */
  let packageJson = {};
  const pkgPath = path.join(gitRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {
      // ignore malformed package.json
    }
  }

  const trackedInfo = getTrackedFiles(gitRoot);
  const untrackedFiles = getUntrackedFiles(gitRoot);

  // Filter tracked source files to scan
  const filesToScan = [];
  for (const fileRel of trackedInfo.files) {
    const ext = path.extname(fileRel);
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
    if (fileRel.startsWith('node_modules/')) continue;
    if (matchesGlob(fileRel, config.ignore)) continue;
    filesToScan.push(fileRel);
  }

  // Pre-scan references to collect candidate paths for batch ignore checking
  const scanDataList = [];
  const candidateTargets = new Set();

  for (const fileRel of filesToScan) {
    const absPath = path.join(gitRoot, fileRel);
    const scan = scanFile(absPath);
    if (scan.skipped) continue;

    scanDataList.push({ fileRel, scan });

    for (const ref of scan.references) {
      if (ref.ignored) continue;
      const importingDir = path.dirname(path.join(gitRoot, fileRel));
      const candBase = path.resolve(importingDir, ref.specifier);
      const candRel = toPosix(path.relative(gitRoot, candBase));
      if (!candRel.startsWith('..')) {
        candidateTargets.add(candRel);
      }
    }
  }

  // Also collect package targets and scripts targets for ignore checking
  if (packageJson.main) candidateTargets.add(toPosix(packageJson.main));
  if (packageJson.module) candidateTargets.add(toPosix(packageJson.module));
  if (packageJson.types) candidateTargets.add(toPosix(packageJson.types));

  // Batch query git check-ignore
  const ignoredMap = checkIgnoredPaths(gitRoot, Array.from(candidateTargets));

  // Execute rules on each scanned reference
  const rawFindings = [];

  for (const { fileRel, scan } of scanDataList) {
    for (const ref of scan.references) {
      if (ref.ignored) continue;

      const resolution = resolveImport(
        gitRoot,
        fileRel,
        ref.specifier,
        trackedInfo,
        untrackedFiles,
        ignoredMap,
        packageJson
      );

      const targetRel = resolution.resolvedRelPath || '';
      const isGenerated = matchesGlob(targetRel, config.generated);

      const f1 = checkCC001(resolution, ref, fileRel, isGenerated);
      if (f1) rawFindings.push(f1);

      const f2 = checkCC002(resolution, ref, fileRel, isGenerated);
      if (f2) rawFindings.push(f2);

      const f3 = checkCC003(resolution, ref, fileRel);
      if (f3) rawFindings.push(f3);

      const f4 = checkCC004(resolution, ref, fileRel);
      if (f4) rawFindings.push(f4);
    }
  }

  // Rule CC005: package manifest targets
  const cc005Findings = checkCC005(gitRoot, packageJson, trackedInfo, ignoredMap, undefined, config.generated);
  rawFindings.push(...cc005Findings);

  // Rule CC006: npm script file references
  const cc006Findings = checkCC006(gitRoot, packageJson, trackedInfo, ignoredMap);
  rawFindings.push(...cc006Findings);

  // Apply config rule overrides and filters
  const finalFindings = [];
  for (const f of rawFindings) {
    const override = config.rules[f.id];
    if (override === 'off') continue;
    if (override && ['error', 'warning', 'info'].includes(override)) {
      f.severity = override;
    }
    finalFindings.push(f);
  }

  // Determine exit code
  let exitCode = 0;
  for (const f of finalFindings) {
    if (config.failOn === 'warning') {
      if (f.severity === 'error' || f.severity === 'warning') {
        exitCode = 1;
        break;
      }
    } else {
      // default: fail on error
      if (f.severity === 'error') {
        exitCode = 1;
        break;
      }
    }
  }

  // Format output
  let output;
  const format = options.format || 'human';
  if (format === 'json') {
    output = renderJson(finalFindings, gitRoot);
  } else if (format === 'github') {
    output = renderGitHub(finalFindings);
  } else {
    output = renderHuman(finalFindings, gitRoot);
  }

  return {
    findings: finalFindings,
    exitCode,
    output,
    gitRoot
  };
}
