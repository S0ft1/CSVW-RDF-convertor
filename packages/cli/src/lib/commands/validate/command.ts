import { CommandModule } from 'yargs';
import { CommonArgs } from '../../common.js';
import { ArgsWithDefaults, handler } from './handler.js';
import { input } from '@inquirer/prompts';

export interface ValidateArgs extends CommonArgs {
  interactive: boolean;
}

export const validate: CommandModule<CommonArgs, ValidateArgs> = {
  command: 'validate',
  describe: 'Validate CSVW',
  builder: {
    interactive: {
      describe: 'Interactive mode',
      type: 'boolean',
      default: false,
    },
  },
  handler: async (args) => {
    args.turtle ??= {};
    if (args.interactive) {
      await interactiveOptions(args);
    } else {
      defaultOptions(args);
    }
    await handler(args as ArgsWithDefaults);
  },
};

async function interactiveOptions(args: ValidateArgs): Promise<void> {
  args.baseIri ??=
    (await input({
      message: `Base IRI for loading resources ${args.input ? '' : '[empty]'}`,
      default: '',
    })) || undefined;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defaultOptions(args: ValidateArgs): void {}
