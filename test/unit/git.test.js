import test from 'node:test';
import assert from 'node:assert/strict';
import { isGitAvailable, getGitRoot, getTrackedFiles, getUntrackedFiles, checkIgnoredPaths } from '../../src/git.js';
import { createTempRepo, cleanupDir, writeProjectFile, gitCommit, createTempDir } from '../helpers/test-utils.js';

test('git: isGitAvailable returns true in test environment', () => {
  assert.equal(isGitAvailable(), true);
});

test('git: getGitRoot returns repository root and throws outside git repo', () => {
  const repo = createTempRepo('git-root-');
  const nonRepo = createTempDir('non-repo-');
  try {
    const root = getGitRoot(repo);
    assert.equal(root.toLowerCase(), repo.toLowerCase());

    assert.throws(
      () => getGitRoot(nonRepo),
      /Not inside a Git repository/
    );
  } finally {
    cleanupDir(repo);
    cleanupDir(nonRepo);
  }
});

test('git: getTrackedFiles, getUntrackedFiles, and checkIgnoredPaths inspect index accurately', () => {
  const repo = createTempRepo('git-index-');
  try {
    // 1. Create and commit tracked file
    writeProjectFile(repo, 'src/tracked.js', 'console.log("tracked");');
    gitCommit(repo, 'initial commit');

    // 2. Create untracked file
    writeProjectFile(repo, 'src/untracked.js', 'console.log("untracked");');

    // 3. Create .gitignore and ignored file
    writeProjectFile(repo, '.gitignore', 'secret.js\n');
    writeProjectFile(repo, 'secret.js', 'const secret = 42;');

    const tracked = getTrackedFiles(repo);
    assert.ok(tracked.files.has('src/tracked.js'));
    assert.equal(tracked.lowerToExactMap.get('src/tracked.js'), 'src/tracked.js');

    const untracked = getUntrackedFiles(repo);
    assert.ok(untracked.has('src/untracked.js'));
    assert.ok(untracked.has('.gitignore'));
    assert.ok(!untracked.has('secret.js'), 'secret.js is ignored, not untracked');

    const ignoredMap = checkIgnoredPaths(repo, ['secret.js', 'src/tracked.js']);
    assert.equal(ignoredMap.get('secret.js')?.ignored, true);
    assert.equal(ignoredMap.get('src/tracked.js'), undefined);
  } finally {
    cleanupDir(repo);
  }
});
