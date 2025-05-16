import { registerCommonArgs } from './common.js';
import { commands } from './commands/index.js';
import { requireYargs } from './utils/require-yargs.js';
export async function runCommands() {
  const y = registerCommonArgs(
    requireYargs()
      .usage('Usage: @csvw-rdf-convertor/cli <command> [options]')
      .recommendCommands()
      .help()
      .demandCommand(1)
      .showHelpOnFail(false)
      .strict()
      .fail(false)
      .parserConfiguration({ 'dot-notation': false })
  ).command(commands);

  try {
    await y.parse();
  } catch (err) {
    if ((err as Error).name === 'ExitPromptError') process.exit(0);
    if (process.env.DEV_MODE) {
      console.error(err);
    } else {
      console.error((err as Error).message);
    }
  }
}
