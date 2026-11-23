import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * Creates an isolated temporary directory.
 * @param {string} prefix
 * @returns {string} Absolute path
 */
export function createTempDir(prefix = 'clonecheck-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Recursively deletes a temporary directory.
 * @param {string} dir
 */
export function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // ignore
  }
}

/**
 * Writes a file with parent directory creation.
 * @param {string} baseDir
 * @param {string} relPath
 * @param {string} content
 */
export function writeProjectFile(baseDir, relPath, content) {
  const fullPath = path.join(baseDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

/**
 * Initializes a fully isolated Git fixture repository.
 * Configures local user and autocrlf so tests never depend on global gitconfig.
 *
 * @param {string} [prefix]
 * @returns {string} Absolute path to initialized repo root
 */
export function createTempRepo(prefix = 'clonecheck-repo-') {
  const repoDir = createTempDir(prefix);

  execFileSync('git', ['init', '-b', 'main'], {
    cwd: repoDir,
    stdio: 'ignore',
    shell: false
  });

  execFileSync('git', ['config', 'user.name', 'Test Agent'], {
    cwd: repoDir,
    stdio: 'ignore',
    shell: false
  });

  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {
    cwd: repoDir,
    stdio: 'ignore',
    shell: false
  });

  execFileSync('git', ['config', 'core.autocrlf', 'false'], {
    cwd: repoDir,
    stdio: 'ignore',
    shell: false
  });

  return repoDir;
}

/**
 * Stages and commits files in fixture repo.
 * @param {string} repoDir
 * @param {string} message
 * @param {string[]} [files=['.']]
 */
export function gitCommit(repoDir, message = 'commit', files = ['.']) {
  execFileSync('git', ['add', ...files], {
    cwd: repoDir,
    stdio: 'ignore',
    shell: false
  });

  execFileSync('git', ['commit', '-m', message], {
    cwd: repoDir,
    stdio: 'ignore',
    shell: false
  });
}
