import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * Require and initialize CommonJS version of yargs. ES module version has worse text wrapping.
 */
export function requireYargs(): Argv {
  const y: Argv = require('yargs')(hideBin(process.argv));
  return y.wrap(Math.min(y.terminalWidth(), 130));
}
