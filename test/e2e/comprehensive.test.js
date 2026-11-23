import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../../src/index.js';
import { createTempRepo, cleanupDir, writeProjectFile, gitCommit } from '../helpers/test-utils.js';

test('e2e: comprehensive repository with all failure cases CC001-CC006', () => {
  const repo = createTempRepo('e2e-all-rules-');
  try {
    // 1. .gitignore and gitignored file (CC001)
    writeProjectFile(repo, '.gitignore', 'secret.js\nnode_modules/\n');
    writeProjectFile(repo, 'src/secret.js', 'export const secret = 123;\n');

    // 2. Untracked file (CC002)
    writeProjectFile(repo, 'src/untracked.js', 'export const untracked = 456;\n');

    // 3. Tracked file with case mismatch in Git index (CC004)
    writeProjectFile(repo, 'src/target.js', 'export const target = 789;\n');

    // 4. Source file importing all above plus missing file (CC003)
    writeProjectFile(repo, 'src/index.js', `
import { secret } from './secret.js';
import { untracked } from './untracked.js';
import { missing } from './missing.js';
import { target } from './Target.js';

// clonecheck-ignore-next-line
import { ignoredMissing } from './ignored-missing.js';
`);

    // 5. Package.json with CC005 (missing main) and CC006 (untracked script)
    writeProjectFile(repo, 'package.json', JSON.stringify({
      name: 'e2e-pkg',
      version: '1.0.0',
      main: './dist/missing-main.js',
      scripts: {
        deploy: 'node scripts/deploy.js'
      }
    }, null, 2));

    writeProjectFile(repo, 'scripts/deploy.js', 'console.log("deploying");\n');

    // Commit tracked files
    gitCommit(repo, 'commit tracked files', ['src/index.js', 'src/target.js', '.gitignore', 'package.json']);

    // Run check()
    const result = check({ path: repo });

    assert.equal(result.exitCode, 1);
    const ruleIds = new Set(result.findings.map(f => f.id));

    assert.ok(ruleIds.has('CC001'), 'Must detect gitignored import CC001');
    assert.ok(ruleIds.has('CC002'), 'Must detect untracked import CC002');
    assert.ok(ruleIds.has('CC003'), 'Must detect missing import CC003');
    assert.ok(ruleIds.has('CC005'), 'Must detect missing package target CC005');
    assert.ok(ruleIds.has('CC006'), 'Must detect untracked script CC006');

    // Verify ignoredMissing was ignored
    const ignoredFound = result.findings.some(f => f.evidence.includes('ignored-missing.js'));
    assert.equal(ignoredFound, false, 'Line with clonecheck-ignore-next-line must not be reported');
  } finally {
    cleanupDir(repo);
  }
});
