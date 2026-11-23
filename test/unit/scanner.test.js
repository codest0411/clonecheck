import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSource, scanFile, isRelativeOrSubpath } from '../../src/scanner.js';
import { createTempDir, cleanupDir, writeProjectFile } from '../helpers/test-utils.js';

test('scanner: isRelativeOrSubpath identifies relative and subpath specifiers', () => {
  assert.equal(isRelativeOrSubpath('./local.js'), true);
  assert.equal(isRelativeOrSubpath('../parent.js'), true);
  assert.equal(isRelativeOrSubpath('#subpath/alias'), true);
  assert.equal(isRelativeOrSubpath('react'), false);
  assert.equal(isRelativeOrSubpath('node:fs'), false);
  assert.equal(isRelativeOrSubpath(/** @type {any} */ (undefined)), false);
});

test('scanner: extracts static imports, exports, dynamic imports, and requires', () => {
  const code = `
import { a } from './util.js';
import b from "../parent.js";
import './side-effect.js';
export { c } from './export.js';
export * from './all.js';

const lazy = import('./dynamic.js');
const legacy = require('./legacy.js');
const external = require('lodash');
import React from 'react';
`;

  const result = scanSource(code);
  assert.equal(result.skipped, false);
  assert.equal(result.references.length, 7);

  const specifiers = result.references.map(r => r.specifier);
  assert.deepEqual(specifiers, [
    './util.js',
    '../parent.js',
    './side-effect.js',
    './export.js',
    './all.js',
    './dynamic.js',
    './legacy.js'
  ]);
});

test('scanner: ignores imports preceded by // clonecheck-ignore-next-line', () => {
  const code = `
import normal from './normal.js';

// clonecheck-ignore-next-line
import ignored from './ignored.js';

import after from './after.js';
`;

  const result = scanSource(code);
  assert.equal(result.references.length, 3);
  assert.equal(result.references[0].ignored, false);
  assert.equal(result.references[1].ignored, true);
  assert.equal(result.references[2].ignored, false);
});

test('scanner: skips comments and does not extract commented imports', () => {
  const code = `
// import fake from './fake-comment.js';
/*
import blockFake from './block-fake.js';
*/
/* inline */ import real from './real.js'; /* comment */
`;

  const result = scanSource(code);
  assert.equal(result.references.length, 1);
  assert.equal(result.references[0].specifier, './real.js');
});

test('scanner: scanFile skips files larger than 2 MB with warning', () => {
  const tempDir = createTempDir('scanner-size-');
  try {
    const bigContent = 'x'.repeat(2 * 1024 * 1024 + 100);
    writeProjectFile(tempDir, 'huge.js', bigContent);

    const res = scanFile(tempDir + '/huge.js');
    assert.equal(res.skipped, true);
    assert.ok(res.skipReason?.includes('exceeds 2 MB limit'));
  } finally {
    cleanupDir(tempDir);
  }
});

test('scanner: fuzz testing with random adversarial buffers never throws and finishes quickly', () => {
  const start = Date.now();
  for (let i = 0; i < 200; i++) {
    const chars = ['import ', 'require(', 'export ', '//', '/*', '*/', "'", '"', '\n', '..', './', '#', '\\'];
    let fuzzString = '';
    const length = 50 + (i % 50);
    for (let j = 0; j < length; j++) {
      fuzzString += chars[Math.floor(Math.random() * chars.length)];
    }
    const res = scanSource(fuzzString);
    assert.ok(Array.isArray(res.references));
  }
  const duration = Date.now() - start;
  assert.ok(duration < 2000, `Fuzz scan took too long: ${duration}ms`);
});
