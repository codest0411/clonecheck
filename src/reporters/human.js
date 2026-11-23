/**
 * Formats findings for terminal display.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @param {string} [_gitRoot]
 * @returns {string}
 */
export function renderHuman(findings, _gitRoot) {
  const isColor = Boolean(process.stdout?.isTTY) && !process.env.NO_COLOR;

  const red = (/** @type {string} */ s) => (isColor ? `\x1b[31m${s}\x1b[0m` : s);
  const yellow = (/** @type {string} */ s) => (isColor ? `\x1b[33m${s}\x1b[0m` : s);
  const blue = (/** @type {string} */ s) => (isColor ? `\x1b[34m${s}\x1b[0m` : s);
  const bold = (/** @type {string} */ s) => (isColor ? `\x1b[1m${s}\x1b[0m` : s);
  const green = (/** @type {string} */ s) => (isColor ? `\x1b[32m${s}\x1b[0m` : s);

  const lines = [];
  lines.push('');
  lines.push(bold('=== clonecheck audit report ==='));
  lines.push('');

  if (findings.length === 0) {
    lines.push(green('✔ All relative references resolve to tracked Git files. Fresh clone safe!'));
    lines.push('');
    return lines.join('\n');
  }

  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    if (f.severity === 'error') errorCount++;
    else if (f.severity === 'warning') warnCount++;
    else infoCount++;

    const badge = f.severity === 'error'
      ? red('[ERROR]')
      : f.severity === 'warning'
        ? yellow('[WARN] ')
        : blue('[INFO] ');

    lines.push(`${badge} ${bold(f.title)} (${f.id})`);
    lines.push(`        File:     ${f.file}:${f.line}:${f.column}`);
    lines.push(`        Evidence: ${f.evidence}`);
    lines.push(`        Why:      ${f.whyItMatters}`);
    lines.push(`        Fix:      ${f.fixAdvice}`);
    lines.push('');
  }

  const summary = `Found ${errorCount} error(s), ${warnCount} warning(s), ${infoCount} info message(s).`;
  lines.push(errorCount > 0 ? red(summary) : warnCount > 0 ? yellow(summary) : summary);
  lines.push('');

  return lines.join('\n');
}
