import { registerCommonArgs } from './common.js';
import { commands } from './commands/index.js';
import { requireYargs } from './utils/require-yargs.js';

export function runCommands() {
  const y = registerCommonArgs(
    requireYargs()
      .usage('Usage: $0 <command> [options]')
      .recommendCommands()
      .help()
      .demandCommand(1)
      .strict()
  );
  y.command(commands).parse();
}
