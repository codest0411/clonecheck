/**
 * Rule CC004: Path resolves on disk only because filesystem is case-insensitive
 * (git index casing differs from import or disk).
 *
 * @param {import('../resolver.js').ResolutionResult} resolution
 * @param {import('../scanner.js').ScannedReference} reference
 * @param {string} importingFile
 * @returns {import('./index.js').Finding | null}
 */
export function checkCC004(resolution, reference, importingFile) {
  if (!resolution.existsOnDisk || !resolution.caseMismatch) {
    return null;
  }

  return {
    id: 'CC004',
    severity: 'error',
    file: importingFile,
    line: reference.line,
    column: reference.column,
    title: 'Path casing mismatches Git index',
    evidence: `Resolved "${resolution.resolvedRelPath}" on disk, but Git index tracks "${resolution.gitIndexPath}".`,
    whyItMatters: 'On case-insensitive filesystems (macOS, Windows) this resolves locally, but on case-sensitive Linux CI runners or containers it fails with Cannot find module.',
    fixAdvice: `Adjust the import specifier casing to match "${resolution.gitIndexPath}" exactly.`
  };
}
