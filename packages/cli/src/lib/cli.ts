import { registerCommonArgs } from './common.js';
import { commands } from './commands/index.js';
import { requireYargs } from './utils/require-yargs.js';

export async function runCommands() {
  const y = registerCommonArgs(
    requireYargs()
      .usage('Usage: $0 <command> [options]')
      .recommendCommands()
      .help()
      .demandCommand(1)
      .strict()
  ).command(commands);

  try {
    await y.parse();
  } catch (e) {
    if (e instanceof Error && e.name === 'ExitPromptError') {
      return;
    }
    throw e;
  }
}
