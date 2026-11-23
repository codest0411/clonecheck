import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveImport } from '../../src/resolver.js';
import { createTempRepo, cleanupDir, writeProjectFile } from '../helpers/test-utils.js';

test('resolver: resolves directory index and #subpath aliases', () => {
  const repo = createTempRepo('resolver-test-');
  try {
    writeProjectFile(repo, 'src/components/index.js', 'export const Button = 1;\n');
    writeProjectFile(repo, 'src/utils/helpers.js', 'export const helper = 2;\n');

    const trackedInfo = {
      files: new Set(['src/components/index.js', 'src/utils/helpers.js']),
      lowerToExactMap: new Map([
        ['src/components/index.js', 'src/components/index.js'],
        ['src/utils/helpers.js', 'src/utils/helpers.js']
      ])
    };
    const untracked = new Set();
    const ignored = new Map();

    const pkg = {
      imports: {
        '#utils': './src/utils/helpers.js'
      }
    };

    // 1. Directory import
    const r1 = resolveImport(repo, 'src/main.js', './components', trackedInfo, untracked, ignored, pkg);
    assert.equal(r1.existsOnDisk, true);
    assert.equal(r1.resolvedRelPath, 'src/components/index.js');
    assert.equal(r1.isTracked, true);

    // 2. Subpath import (#utils)
    const r2 = resolveImport(repo, 'src/main.js', '#utils', trackedInfo, untracked, ignored, pkg);
    assert.equal(r2.existsOnDisk, true);
    assert.equal(r2.resolvedRelPath, 'src/utils/helpers.js');
    assert.equal(r2.isTracked, true);

    // 3. Path escaping repo root
    const r3 = resolveImport(repo, 'src/main.js', '../../outside.js', trackedInfo, untracked, ignored, pkg);
    assert.equal(r3.existsOnDisk, false);
    assert.ok(r3.error?.includes('escapes repository root'));
  } finally {
    cleanupDir(repo);
  }
});
