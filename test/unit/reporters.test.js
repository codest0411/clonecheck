import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHuman, renderJson, renderGitHub } from '../../src/reporters/index.js';

const mockFindings = [
  {
    id: 'CC001',
    severity: /** @type {'error'} */ ('error'),
    file: 'src/index.js',
    line: 12,
    column: 1,
    title: 'Import of gitignored file',
    evidence: '"./secret.js" resolves to gitignored "src/secret.js".',
    whyItMatters: 'Breaks in CI and fresh clone.',
    fixAdvice: 'Track in git or do not import.'
  },
  {
    id: 'CC006',
    severity: /** @type {'warning'} */ ('warning'),
    file: 'package.json',
    line: 1,
    column: 1,
    title: 'Script references untracked file',
    evidence: 'Script "build" references "scripts/build.js".',
    whyItMatters: 'Fails for teammates.',
    fixAdvice: 'Git add scripts/build.js.'
  }
];

test('reporters: renderHuman formats clean message when no findings', () => {
  const out = renderHuman([], '/repo');
  assert.ok(out.includes('All relative references resolve to tracked Git files'));
});

test('reporters: renderHuman formats findings with error and warning details', () => {
  const out = renderHuman(mockFindings, '/repo');
  assert.ok(out.includes('[ERROR] Import of gitignored file (CC001)'));
  assert.ok(out.includes('File:     src/index.js:12:1'));
  assert.ok(out.includes('[WARN]  Script references untracked file (CC006)'));
  assert.ok(out.includes('Found 1 error(s), 1 warning(s)'));
});

test('reporters: renderJson produces valid JSON with correct counts', () => {
  const jsonStr = renderJson(mockFindings, '/repo');
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.generator, 'clonecheck');
  assert.equal(parsed.counts.total, 2);
  assert.equal(parsed.counts.errors, 1);
  assert.equal(parsed.counts.warnings, 1);
  assert.equal(parsed.findings.length, 2);
});

test('reporters: renderGitHub escapes workflow control characters properly', () => {
  const out = renderGitHub(mockFindings);
  assert.ok(out.includes('::error file=src/index.js,line=12,col=1,title=[CC001] Import of gitignored file::'));
  assert.ok(out.includes('::warning file=package.json,line=1,col=1,title=[CC006] Script references untracked file::'));
});
