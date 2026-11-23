import path from 'node:path';
import fs from 'node:fs';
import { toPosix, isInsideRoot } from '../paths.js';

/**
 * Rule CC006: npm scripts that invoke local script files that are untracked or gitignored.
 * Example: "build": "node scripts/build.js"
 *
 * @param {string} gitRoot
 * @param {Record<string, any>} packageJson
 * @param {import('../git.js').TrackedFilesInfo} trackedInfo
 * @param {Map<string, { ignored: boolean }>} ignoredMap
 * @returns {import('./index.js').Finding[]}
 */
export function checkCC006(gitRoot, packageJson, trackedInfo, ignoredMap) {
  /** @type {import('./index.js').Finding[]} */
  const findings = [];
  if (!packageJson?.scripts || typeof packageJson.scripts !== 'object') {
    return findings;
  }

  // Linear-time regex to find local script references like:
  // node scripts/x.js, ./scripts/x.sh, tsx src/index.ts
  const scriptCallPattern = /(?:^|\s|&&|;|\|\|)(?:node|tsx|ts-node|bash|sh)?\s*(?:\.\/)?([a-zA-Z0-9_./-]+\.(?:[cm]?[jt]sx?|sh|py|rb))\b/g;

  for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
    if (typeof scriptCommand !== 'string') continue;

    let match;
    while ((match = scriptCallPattern.exec(scriptCommand)) !== null) {
      const candidateRel = match[1];
      if (!candidateRel || candidateRel.startsWith('node_modules/')) continue;

      const absPath = path.resolve(gitRoot, candidateRel);
      if (!isInsideRoot(gitRoot, absPath)) continue;

      const relPath = toPosix(path.relative(gitRoot, absPath));
      const lowerRel = relPath.toLowerCase();

      // Check if file exists on disk
      try {
        if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
          continue;
        }
      } catch {
        continue;
      }

      const isIgnored = ignoredMap.get(relPath)?.ignored || false;
      const isTracked = trackedInfo.lowerToExactMap.has(lowerRel);

      if (isIgnored) {
        findings.push({
          id: 'CC006',
          severity: 'warning',
          file: 'package.json',
          line: 1,
          column: 1,
          title: `Script "${scriptName}" references gitignored file`,
          evidence: `Script command "${scriptCommand}" references gitignored file "${relPath}".`,
          whyItMatters: 'A fresh clone or CI runner will fail running this script because the file is not tracked.',
          fixAdvice: `Track "${relPath}" in git or update the script.`
        });
      } else if (!isTracked) {
        findings.push({
          id: 'CC006',
          severity: 'warning',
          file: 'package.json',
          line: 1,
          column: 1,
          title: `Script "${scriptName}" references untracked file`,
          evidence: `Script command "${scriptCommand}" references untracked file "${relPath}".`,
          whyItMatters: 'Teammates or CI running "npm run ${scriptName}" will fail because the script file is not committed.',
          fixAdvice: `Commit "${relPath}" to git with "git add ${relPath}".`
        });
      }
    }
  }

  return findings;
}
