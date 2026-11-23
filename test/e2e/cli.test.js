import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli.js';
import { createTempRepo, cleanupDir, writeProjectFile, gitCommit, createTempDir } from '../helpers/test-utils.js';

test('cli: --help outputs usage information and returns 0', () => {
  let output = '';
  const oldLog = console.log;
  console.log = (msg) => { output += msg + '\n'; };

  try {
    const code = runCli(['--help']);
    assert.equal(code, 0);
    assert.ok(output.includes('Usage:'));
    assert.ok(output.includes('clonecheck [path] [options]'));
  } finally {
    console.log = oldLog;
  }
});

test('cli: --version outputs version and returns 0', () => {
  let output = '';
  const oldLog = console.log;
  console.log = (msg) => { output += msg + '\n'; };

  try {
    const code = runCli(['--version']);
    assert.equal(code, 0);
    assert.ok(output.includes('clonecheck v'));
  } finally {
    console.log = oldLog;
  }
});

test('cli: clean repository returns exit code 0', () => {
  const repo = createTempRepo('cli-clean-');
  try {
    writeProjectFile(repo, 'package.json', JSON.stringify({ name: 'clean-repo', version: '1.0.0' }));
    writeProjectFile(repo, 'src/index.js', 'console.log("hello");\n');
    gitCommit(repo, 'initial commit');

    const code = runCli([repo]);
    assert.equal(code, 0);
  } finally {
    cleanupDir(repo);
  }
});

test('cli: repo with broken import returns exit code 1', () => {
  const repo = createTempRepo('cli-broken-');
  try {
    writeProjectFile(repo, 'package.json', JSON.stringify({ name: 'broken-repo', version: '1.0.0' }));
    writeProjectFile(repo, 'src/index.js', 'import "./missing.js";\n');
    gitCommit(repo, 'initial commit');

    const code = runCli([repo]);
    assert.equal(code, 1);
  } finally {
    cleanupDir(repo);
  }
});

test('cli: non-git directory returns exit code 2', () => {
  const nonRepo = createTempDir('cli-non-repo-');
  try {
    const code = runCli([nonRepo]);
    assert.equal(code, 2);
  } finally {
    cleanupDir(nonRepo);
  }
});

test('cli: invalid command option returns exit code 2', () => {
  const code = runCli(['--invalid-flag-that-does-not-exist']);
  assert.equal(code, 2);
});
