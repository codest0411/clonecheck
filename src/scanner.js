import fs from 'node:fs';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Scanned import reference.
 * @typedef {Object} ScannedReference
 * @property {string} specifier The raw import string (e.g. './util.js')
 * @property {number} line 1-based line number
 * @property {number} column 1-based column number
 * @property {boolean} ignored True if suppressed by // clonecheck-ignore-next-line
 * @property {string} kind 'import' | 'export' | 'require' | 'dynamic-import'
 */

/**
 * Result of scanning a file.
 * @typedef {Object} ScanResult
 * @property {ScannedReference[]} references
 * @property {boolean} skipped
 * @property {string} [skipReason]
 */

/**
 * Scans a file on disk for relative module references.
 *
 * @param {string} filePath Absolute path to file on disk
 * @returns {ScanResult}
 */
export function scanFile(filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { references: [], skipped: true, skipReason: `Could not read file: ${msg}` };
  }

  if (stat.size > MAX_FILE_SIZE_BYTES) {
    return {
      references: [],
      skipped: true,
      skipReason: `File size (${(stat.size / (1024 * 1024)).toFixed(2)} MB) exceeds 2 MB limit`
    };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { references: [], skipped: true, skipReason: `Read error: ${msg}` };
  }

  return scanSource(content);
}

/**
 * Scans source text for relative import and require statements.
 *
 * @param {string} source Source text
 * @returns {ScanResult}
 */
export function scanSource(source) {
  if (typeof source !== 'string' || source.length === 0) {
    return { references: [], skipped: false };
  }

  const references = [];
  const lines = source.split(/\r?\n/);
  const ignoredLines = new Set();

  // 1. Identify clonecheck-ignore-next-line comments
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('clonecheck-ignore-next-line')) {
      // The comment ignores the immediate next line (1-based: i + 2)
      ignoredLines.add(i + 2);
    }
  }

  // 2. Tokenize and extract import statements safely
  // Regex patterns designed to be strictly linear-time without ReDoS.
  // We match:
  // - import/export from '...' or "..."
  // - import '...' or "..."
  // - require('...') or require("...")
  // - import('...') or import("...")

  // We scan line by line while handling multi-line comments
  let inBlockComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNumber = lineIdx + 1;
    const isIgnored = ignoredLines.has(lineNumber);
    let line = lines[lineIdx];

    // Handle block comments across lines
    if (inBlockComment) {
      const endCommentIdx = line.indexOf('*/');
      if (endCommentIdx === -1) {
        continue;
      }
      line = ' '.repeat(endCommentIdx + 2) + line.slice(endCommentIdx + 2);
      inBlockComment = false;
    }

    // Strip inline block comments /* ... */
    while (line.includes('/*')) {
      const startIdx = line.indexOf('/*');
      const endIdx = line.indexOf('*/', startIdx + 2);
      if (endIdx === -1) {
        line = line.slice(0, startIdx);
        inBlockComment = true;
        break;
      } else {
        line = line.slice(0, startIdx) + ' '.repeat(endIdx - startIdx + 2) + line.slice(endIdx + 2);
      }
    }

    // Strip single line comment //
    const singleCommentIdx = line.indexOf('//');
    if (singleCommentIdx !== -1) {
      line = line.slice(0, singleCommentIdx);
    }

    // Fast check: does this line have any keyword?
    if (!line.includes('import') && !line.includes('require') && !line.includes('export')) {
      continue;
    }

    // Static imports/exports:
    // import ... from ['"](.*)['"]
    // export ... from ['"](.*)['"]
    // import ['"](.*)['"]
    const staticPattern = /(?:import|export)\s+(?:[\w\s{},*]+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = staticPattern.exec(line)) !== null) {
      const specifier = match[1];
      if (isRelativeOrSubpath(specifier)) {
        references.push({
          specifier,
          line: lineNumber,
          column: match.index + 1,
          ignored: isIgnored,
          kind: match[0].startsWith('export') ? 'export' : 'import'
        });
      }
    }

    // Dynamic import: import(['"](.*)['"])
    const dynamicImportPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportPattern.exec(line)) !== null) {
      const specifier = match[1];
      if (isRelativeOrSubpath(specifier)) {
        references.push({
          specifier,
          line: lineNumber,
          column: match.index + 1,
          ignored: isIgnored,
          kind: 'dynamic-import'
        });
      }
    }

    // CommonJS require: require(['"](.*)['"])
    const requirePattern = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requirePattern.exec(line)) !== null) {
      const specifier = match[1];
      if (isRelativeOrSubpath(specifier)) {
        references.push({
          specifier,
          line: lineNumber,
          column: match.index + 1,
          ignored: isIgnored,
          kind: 'require'
        });
      }
    }
  }

  return {
    references,
    skipped: false
  };
}

/**
 * Checks if a specifier is relative (./, ../) or a package.json subpath (#...).
 *
 * @param {string} specifier
 * @returns {boolean}
 */
export function isRelativeOrSubpath(specifier) {
  if (typeof specifier !== 'string') return false;
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('#');
}
