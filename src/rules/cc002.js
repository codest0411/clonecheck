/**
 * Rule CC002: Relative import resolves to a file that exists but is UNTRACKED and not ignored.
 *
 * @param {import('../resolver.js').ResolutionResult} resolution
 * @param {import('../scanner.js').ScannedReference} reference
 * @param {string} importingFile
 * @param {boolean} isGenerated
 * @returns {import('./index.js').Finding | null}
 */
export function checkCC002(resolution, reference, importingFile, isGenerated) {
  if (!resolution.existsOnDisk || resolution.isIgnored || resolution.isTracked) {
    return null;
  }

  const severity = isGenerated ? 'info' : 'error';

  return {
    id: 'CC002',
    severity,
    file: importingFile,
    line: reference.line,
    column: reference.column,
    title: isGenerated ? 'Import of untracked generated output' : 'Import of untracked file',
    evidence: `"${reference.specifier}" resolves to untracked "${resolution.resolvedRelPath}".`,
    whyItMatters: 'The file exists locally on your workstation but has never been committed or tracked in Git. CI and fresh clones will fail.',
    fixAdvice: `Run "git add ${resolution.resolvedRelPath}" and commit the file before pushing.`
  };
}
