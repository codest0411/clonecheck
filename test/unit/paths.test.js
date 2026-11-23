import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { toPosix, isInsideRoot, isRealpathInsideRoot, matchesGlob } from '../../src/paths.js';
import { createTempDir, cleanupDir, writeProjectFile } from '../helpers/test-utils.js';

test('paths: toPosix normalizes backslashes to forward slashes', () => {
  assert.equal(toPosix('foo\\bar\\baz.js'), 'foo/bar/baz.js');
  assert.equal(toPosix('C:\\Users\\test\\project'), 'C:/Users/test/project');
  assert.equal(toPosix('already/posix/path.js'), 'already/posix/path.js');
  assert.equal(toPosix(/** @type {any} */ (null)), '');
});

test('paths: isInsideRoot detects directory traversal attempts', () => {
  const root = path.resolve('/repo');

  assert.equal(isInsideRoot(root, path.resolve(root, 'src/index.js')), true);
  assert.equal(isInsideRoot(root, path.resolve(root, 'sub/folder/file.js')), true);
  assert.equal(isInsideRoot(root, path.resolve(root, '../outside.js')), false);
  assert.equal(isInsideRoot(root, path.resolve(root, '../../etc/passwd')), false);
});

test('paths: isRealpathInsideRoot respects real filesystem boundaries', () => {
  const tempDir = createTempDir('paths-test-');
  try {
    writeProjectFile(tempDir, 'src/file.js', 'console.log(1);');
    const safePath = path.join(tempDir, 'src', 'file.js');
    assert.equal(isRealpathInsideRoot(tempDir, safePath), true);

    const outsidePath = path.join(tempDir, '..', 'something-else.js');
    assert.equal(isRealpathInsideRoot(tempDir, outsidePath), false);
  } finally {
    cleanupDir(tempDir);
  }
});

test('paths: matchesGlob matches simple patterns and double-star globs', () => {
  assert.equal(matchesGlob('dist/index.js', ['dist/**']), true);
  assert.equal(matchesGlob('dist/sub/deep/bundle.js', ['dist/**']), true);
  assert.equal(matchesGlob('src/index.js', ['dist/**']), false);
  assert.equal(matchesGlob('test/cli.test.js', ['test/*.test.js']), true);
  assert.equal(matchesGlob('test/sub/cli.test.js', ['test/*.test.js']), false);
  assert.equal(matchesGlob('README.md', ['README.md']), true);
  assert.equal(matchesGlob('empty', []), false);
});
