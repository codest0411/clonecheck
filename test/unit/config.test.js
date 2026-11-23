import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/config.js';
import { createTempDir, cleanupDir, writeProjectFile } from '../helpers/test-utils.js';

test('config: returns default configuration when no file exists', () => {
  const tempDir = createTempDir('config-def-');
  try {
    const config = loadConfig(tempDir);
    assert.deepEqual(config.ignore, []);
    assert.deepEqual(config.generated, ['dist/**', 'build/**']);
    assert.equal(config.failOn, 'error');
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: loads valid .clonecheckrc.json configuration file', () => {
  const tempDir = createTempDir('config-valid-');
  try {
    writeProjectFile(tempDir, '.clonecheckrc.json', JSON.stringify({
      ignore: ['legacy/**'],
      generated: ['out/**'],
      failOn: 'warning',
      rules: {
        CC006: 'off'
      }
    }));

    const config = loadConfig(tempDir);
    assert.deepEqual(config.ignore, ['legacy/**']);
    assert.deepEqual(config.generated, ['out/**']);
    assert.equal(config.failOn, 'warning');
    assert.equal(config.rules.CC006, 'off');
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: throws error when specified custom config file does not exist', () => {
  const tempDir = createTempDir('config-missing-');
  try {
    assert.throws(
      () => loadConfig(tempDir, 'nonexistent.json'),
      /Specified config file not found/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: rejects prototype pollution attempt in keys', () => {
  const tempDir = createTempDir('config-sec-');
  try {
    writeProjectFile(tempDir, '.clonecheckrc.json', '{"__proto__": {"polluted": true}}');
    assert.throws(
      () => loadConfig(tempDir),
      /illegal prototype key/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: rejects unknown configuration keys', () => {
  const tempDir = createTempDir('config-unknown-');
  try {
    writeProjectFile(tempDir, '.clonecheckrc.json', JSON.stringify({ invalidKey: 123 }));
    assert.throws(
      () => loadConfig(tempDir),
      /Unknown configuration property/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: rejects invalid failOn threshold', () => {
  const tempDir = createTempDir('config-failon-');
  try {
    writeProjectFile(tempDir, '.clonecheckrc.json', JSON.stringify({ failOn: 'invalid-level' }));
    assert.throws(
      () => loadConfig(tempDir),
      /Invalid "failOn" value/
    );
  } finally {
    cleanupDir(tempDir);
  }
});
