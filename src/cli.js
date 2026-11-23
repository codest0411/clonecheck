import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes the clonecheck CLI command.
 *
 * @param {string[]} args Command-line arguments
 * @returns {number} Exit code
 */
export function runCli(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        format: { type: 'string' },
        config: { type: 'string' },
        'fail-on': { type: 'string' },
        ignore: { type: 'string' },
        pack: { type: 'boolean' }
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`clonecheck error: ${msg}`);
    console.error('Run "clonecheck --help" for usage information.');
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    printHelp();
    return 0;
  }

  if (values.version) {
    printVersion();
    return 0;
  }

  const targetPath = positionals[0] || process.cwd();

  const ignoreList = values.ignore
    ? values.ignore.split(',').map((/** @type {string} */ s) => s.trim()).filter(Boolean)
    : [];

  try {
    const result = check({
      path: targetPath,
      config: values.config,
      format: /** @type {'human' | 'json' | 'github'} */ (values.format || 'human'),
      failOn: /** @type {'error' | 'warning'} */ (values['fail-on']),
      ignore: ignoreList,
      pack: Boolean(values.pack)
    });

    if (result.output) {
      console.log(result.output);
    }

    return result.exitCode;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`clonecheck runtime error: ${msg}`);
    return 2;
  }
}

function printHelp() {
  console.log(`
clonecheck - Statically detect imports/references to gitignored or untracked files

Usage:
  clonecheck [path] [options]

Arguments:
  path                     Target directory (default: current working directory)

Options:
  --format <type>          Output format: human (default), json, github
  --config <path>          Path to custom .clonecheckrc.json configuration file
  --fail-on <severity>     Exit with code 1 threshold: error (default), warning
  --ignore <glob>          Comma-separated list of glob patterns to ignore
  --pack                   Verify entry points against npm pack dry-run inclusions
  -v, --version            Display version
  -h, --help               Display help message

Examples:
  npx clonecheck
  npx clonecheck ./packages/core --format json
  npx clonecheck --fail-on warning
`);
}

function printVersion() {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(`clonecheck v${pkg.version}`);
  } catch {
    console.log('clonecheck v0.1.0');
  }
}
