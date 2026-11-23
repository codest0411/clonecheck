import fs from 'node:fs';
import path from 'node:path';

const VALID_CONFIG_KEYS = new Set(['ignore', 'generated', 'failOn', 'rules']);
const VALID_FAIL_ON = new Set(['error', 'warning']);
const BANNED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Clonecheck Configuration.
 * @typedef {Object} ClonecheckConfig
 * @property {string[]} ignore Glob patterns of files to ignore from checks
 * @property {string[]} generated Glob patterns for build outputs (downgrade to info)
 * @property {'error' | 'warning'} failOn Threshold for non-zero exit code
 * @property {Record<string, 'error' | 'warning' | 'info' | 'off'>} rules Per-rule severity overrides
 */

/**
 * Returns default configuration object.
 * @returns {ClonecheckConfig}
 */
export function getDefaultConfig() {
  return {
    ignore: [],
    generated: ['dist/**', 'build/**'],
    failOn: 'error',
    rules: Object.create(null)
  };
}

/**
 * Loads and validates `.clonecheckrc.json` or custom config path.
 *
 * @param {string} rootDir
 * @param {string} [customPath]
 * @returns {ClonecheckConfig}
 */
export function loadConfig(rootDir, customPath) {
  const config = getDefaultConfig();
  const targetFile = customPath ? path.resolve(rootDir, customPath) : path.join(rootDir, '.clonecheckrc.json');

  if (customPath && !fs.existsSync(targetFile)) {
    throw new Error(`Specified config file not found: ${customPath}`);
  }

  if (!fs.existsSync(targetFile)) {
    return config;
  }

  let raw;
  try {
    raw = fs.readFileSync(targetFile, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read config file ${targetFile}: ${msg}`, { cause: err });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Malformed JSON in config file ${targetFile}: ${msg}`, { cause: err });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid config format in ${targetFile}: expected a JSON object.`);
  }

  // Validate properties against unknown keys and prototype pollution
  for (const key of Object.keys(parsed)) {
    if (BANNED_KEYS.has(key)) {
      throw new Error(`Security violation: illegal prototype key "${key}" in config.`);
    }
    if (!VALID_CONFIG_KEYS.has(key)) {
      throw new Error(`Unknown configuration property "${key}" in ${targetFile}. Allowed: ignore, generated, failOn, rules.`);
    }
  }

  // Validate ignore
  if (parsed.ignore !== undefined) {
    if (!Array.isArray(parsed.ignore) || !parsed.ignore.every((/** @type {any} */ x) => typeof x === 'string')) {
      throw new Error(`Invalid "ignore" in ${targetFile}: must be an array of string glob patterns.`);
    }
    config.ignore = [...parsed.ignore];
  }

  // Validate generated
  if (parsed.generated !== undefined) {
    if (!Array.isArray(parsed.generated) || !parsed.generated.every((/** @type {any} */ x) => typeof x === 'string')) {
      throw new Error(`Invalid "generated" in ${targetFile}: must be an array of string glob patterns.`);
    }
    config.generated = [...parsed.generated];
  }

  // Validate failOn
  if (parsed.failOn !== undefined) {
    if (!VALID_FAIL_ON.has(parsed.failOn)) {
      throw new Error(`Invalid "failOn" value "${parsed.failOn}" in ${targetFile}. Allowed: error, warning.`);
    }
    config.failOn = parsed.failOn;
  }

  // Validate rules
  if (parsed.rules !== undefined) {
    if (typeof parsed.rules !== 'object' || parsed.rules === null || Array.isArray(parsed.rules)) {
      throw new Error(`Invalid "rules" in ${targetFile}: must be an object.`);
    }
    const cleanRules = Object.create(null);
    for (const [rId, rVal] of Object.entries(parsed.rules)) {
      if (BANNED_KEYS.has(rId)) {
        throw new Error(`Security violation: illegal prototype key in rules: "${rId}".`);
      }
      if (!['error', 'warning', 'info', 'off'].includes(rVal)) {
        throw new Error(`Invalid rule setting for "${rId}": "${rVal}". Allowed: error, warning, info, off.`);
      }
      cleanRules[rId] = rVal;
    }
    config.rules = cleanRules;
  }

  return config;
}
