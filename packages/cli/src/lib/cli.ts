import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { validate } from './validate.js';

export function runCommands() {
  yargs(hideBin(process.argv))
    .usage('Usage: $0 <command> [options]')
    .help()
    .demandCommand(1)
    .command(validate)
    .parse();
}
