/**
 * Formats findings as GitHub Actions workflow commands.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @returns {string}
 */
export function renderGitHub(findings) {
  const escapeData = (/** @type {string} */ s) =>
    s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

  const escapeProperty = (/** @type {string} */ s) =>
    s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');

  const lines = [];

  for (const f of findings) {
    const level = f.severity === 'error' ? 'error' : f.severity === 'warning' ? 'warning' : 'notice';
    const title = escapeProperty(`[${f.id}] ${f.title}`);
    const message = escapeData(`${f.evidence} - ${f.whyItMatters} Fix: ${f.fixAdvice}`);
    lines.push(`::${level} file=${f.file},line=${f.line},col=${f.column},title=${title}::${message}`);
  }

  return lines.join('\n');
}
