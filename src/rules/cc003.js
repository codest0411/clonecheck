/**
 * Rule CC003: Relative import resolves to nothing on disk.
 *
 * @param {import('../resolver.js').ResolutionResult} resolution
 * @param {import('../scanner.js').ScannedReference} reference
 * @param {string} importingFile
 * @returns {import('./index.js').Finding | null}
 */
export function checkCC003(resolution, reference, importingFile) {
  if (resolution.existsOnDisk) {
    return null;
  }

  return {
    id: 'CC003',
    severity: 'error',
    file: importingFile,
    line: reference.line,
    column: reference.column,
    title: 'Import resolves to missing file',
    evidence: `"${reference.specifier}" could not be found on disk.`,
    whyItMatters: 'Importing a nonexistent path fails immediately at runtime or during bundling.',
    fixAdvice: 'Verify the import path spelling, file extension, or create the missing file.'
  };
}
