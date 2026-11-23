import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCC001, checkCC002, checkCC003, checkCC004, checkCC005, checkCC006 } from '../../src/rules/index.js';
import { createTempRepo, cleanupDir, writeProjectFile } from '../helpers/test-utils.js';

test('rules: CC001 identifies gitignored import and handles generated downgrade', () => {
  const resolution = {
    existsOnDisk: true,
    resolvedRelPath: 'src/secret.js',
    isTracked: false,
    isIgnored: true,
    isUntracked: false,
    caseMismatch: false,
    gitIndexPath: null,
    ignorePattern: 'secret.js',
    ignoreSource: '.gitignore',
    error: null
  };

  const ref = {
    specifier: './secret.js',
    line: 5,
    column: 1,
    ignored: false,
    kind: 'import'
  };

  // Standard gitignored file -> error
  const f1 = checkCC001(resolution, ref, 'src/index.js', false);
  assert.ok(f1 !== null);
  assert.equal(f1.id, 'CC001');
  assert.equal(f1.severity, 'error');
  assert.ok(f1.evidence.includes('.gitignore'));

  // Generated build artifact -> downgraded to info
  const f2 = checkCC001(resolution, ref, 'src/index.js', true);
  assert.ok(f2 !== null);
  assert.equal(f2.id, 'CC001');
  assert.equal(f2.severity, 'info');
});

test('rules: CC002 identifies untracked file import', () => {
  const resolution = {
    existsOnDisk: true,
    resolvedRelPath: 'src/local.js',
    isTracked: false,
    isIgnored: false,
    isUntracked: true,
    caseMismatch: false,
    gitIndexPath: null,
    error: null
  };

  const ref = {
    specifier: './local.js',
    line: 10,
    column: 1,
    ignored: false,
    kind: 'import'
  };

  const f = checkCC002(resolution, ref, 'src/index.js', false);
  assert.ok(f !== null);
  assert.equal(f.id, 'CC002');
  assert.equal(f.severity, 'error');
  assert.ok(f.whyItMatters.includes('never been committed'));
});

test('rules: CC003 identifies nonexistent file import', () => {
  const resolution = {
    existsOnDisk: false,
    resolvedRelPath: 'src/missing.js',
    isTracked: false,
    isIgnored: false,
    isUntracked: false,
    caseMismatch: false,
    gitIndexPath: null,
    error: null
  };

  const ref = {
    specifier: './missing.js',
    line: 1,
    column: 1,
    ignored: false,
    kind: 'import'
  };

  const f = checkCC003(resolution, ref, 'src/index.js');
  assert.ok(f !== null);
  assert.equal(f.id, 'CC003');
  assert.equal(f.severity, 'error');
});

test('rules: CC004 identifies case-sensitivity mismatch with Git index', () => {
  const resolution = {
    existsOnDisk: true,
    resolvedRelPath: 'src/MyModule.js',
    isTracked: true,
    isIgnored: false,
    isUntracked: false,
    caseMismatch: true,
    gitIndexPath: 'src/mymodule.js',
    error: null
  };

  const ref = {
    specifier: './MyModule.js',
    line: 2,
    column: 1,
    ignored: false,
    kind: 'import'
  };

  const f = checkCC004(resolution, ref, 'src/index.js');
  assert.ok(f !== null);
  assert.equal(f.id, 'CC004');
  assert.equal(f.severity, 'error');
  assert.ok(f.evidence.includes('src/mymodule.js'));
});

test('rules: CC005 flags untracked or missing package.json targets', () => {
  const repo = createTempRepo('rules-cc005-');
  try {
    writeProjectFile(repo, 'src/index.js', 'console.log(1);');
    writeProjectFile(repo, 'src/ignored.js', 'console.log(2);');
    writeProjectFile(repo, 'src/untracked.js', 'console.log(3);');

    const pkg = {
      main: './dist/index.js',
      module: './src/index.js',
      types: './src/ignored.js',
      bin: { mytool: './src/untracked.js' },
      exports: {
        '.': './src/index.js',
        './sub': './dist/missing.js'
      }
    };

    const trackedInfo = {
      files: new Set(['src/index.js']),
      lowerToExactMap: new Map([['src/index.js', 'src/index.js']])
    };
    const ignoredMap = new Map([
      ['src/ignored.js', { ignored: true, pattern: '*.js', source: '.gitignore' }]
    ]);

    // 1. Without packFiles
    const findings = checkCC005(repo, pkg, trackedInfo, ignoredMap);
    assert.ok(findings.some(f => f.evidence.includes('./dist/index.js')));
    assert.ok(findings.some(f => f.evidence.includes('./src/ignored.js')));
    assert.ok(findings.some(f => f.evidence.includes('./src/untracked.js')));
    assert.ok(findings.some(f => f.evidence.includes('./dist/missing.js')));

    // 2. With packFiles where main is omitted from publish list
    const packFindings = checkCC005(repo, pkg, trackedInfo, ignoredMap, ['src/index.js']);
    assert.ok(packFindings.some(f => f.title.includes('not in publish tarball')));
  } finally {
    cleanupDir(repo);
  }
});

test('rules: CC006 flags npm scripts referencing untracked or ignored scripts', () => {
  const repo = createTempRepo('rules-cc006-');
  try {
    writeProjectFile(repo, 'scripts/build.js', 'console.log("build");');
    writeProjectFile(repo, 'scripts/clean.sh', '#!/bin/sh\n');
    const pkg = {
      scripts: {
        build: 'node scripts/build.js',
        clean: 'bash scripts/clean.sh'
      }
    };

    const trackedInfo = {
      files: new Set(),
      lowerToExactMap: new Map()
    };
    const ignoredMap = new Map([
      ['scripts/clean.sh', { ignored: true }]
    ]);

    const findings = checkCC006(repo, pkg, trackedInfo, ignoredMap);
    assert.equal(findings.length, 2);
    assert.ok(findings.some(f => f.title.includes('references untracked file')));
    assert.ok(findings.some(f => f.title.includes('references gitignored file')));
  } finally {
    cleanupDir(repo);
  }
});
