/**
 * Rule CC001: Relative import resolves to a file that is GITIGNORED.
 *
 * @param {import('../resolver.js').ResolutionResult} resolution
 * @param {import('../scanner.js').ScannedReference} reference
 * @param {string} importingFile
 * @param {boolean} isGenerated
 * @returns {import('./index.js').Finding | null}
 */
export function checkCC001(resolution, reference, importingFile, isGenerated) {
  if (!resolution.existsOnDisk || !resolution.isIgnored) {
    return null;
  }

  const severity = isGenerated ? 'info' : 'error';
  const patternNote = resolution.ignorePattern
    ? ` Ignored by rule "${resolution.ignorePattern}" in ${resolution.ignoreSource || '.gitignore'}.`
    : '';

  return {
    id: 'CC001',
    severity,
    file: importingFile,
    line: reference.line,
    column: reference.column,
    title: isGenerated ? 'Import of gitignored build output' : 'Import of gitignored file',
    evidence: `"${reference.specifier}" resolves to gitignored "${resolution.resolvedRelPath}".${patternNote}`,
    whyItMatters: isGenerated
      ? 'File is a generated build artifact configured in generated list. Will not exist until built.'
      : 'A fresh clone or CI runner will not have this file because git ignores it, causing module resolution failure.',
    fixAdvice: isGenerated
      ? 'Ensure your build command runs before tests or lint in CI.'
      : 'Remove the file from .gitignore and track it in git, or avoid importing gitignored files.'
  };
}
