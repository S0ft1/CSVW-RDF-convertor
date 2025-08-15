import { CommandModule } from 'yargs';
import { CommonArgs } from '../../common.js';
import { ArgsWithDefaults, handler } from './handler.js';
import { input } from '@inquirer/prompts';

export type TurtleOptions = {
  base?: string;
  prefix?: Record<string, string>;
} & (
  | {
      prefixLookup?: true;
      streaming?: false;
    }
  | {
      prefixLookup?: false;
      streaming?: true;
    }
);

export interface ValidateArgs extends CommonArgs {
  interactive: boolean;
}

export const csvw2rdf: CommandModule<CommonArgs, ValidateArgs> = {
  command: 'csvw2rdf',
  aliases: ['c2r'],
  describe: 'Convert CSVW to RDF',
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
      default: args.input ?? '',
    })) || undefined;
}
function defaultOptions(args: ValidateArgs): void {
  args.baseIri ??= args.input;
}
