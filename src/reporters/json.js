/**
 * Formats findings as structured JSON.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @param {string} gitRoot
 * @returns {string}
 */
export function renderJson(findings, gitRoot) {
  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const info = findings.filter(f => f.severity === 'info').length;

  const output = {
    generator: 'clonecheck',
    timestamp: new Date().toISOString(),
    gitRoot,
    counts: {
      total: findings.length,
      errors,
      warnings,
      info
    },
    findings
  };

  return JSON.stringify(output, null, 2);
}
