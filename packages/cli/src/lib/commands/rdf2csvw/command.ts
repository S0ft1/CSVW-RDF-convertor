import { CommonArgs } from '../../common.js';
import { resolve } from 'node:path';
import { CommandModule } from 'yargs';
import { input } from '@inquirer/prompts';
import { handler } from './handler.js';

export interface R2CArgs extends CommonArgs {
  outDir: string;
  interactive: boolean;
  descriptor?: string;
  windowSize?: number;
  useVocabMetadata: boolean;
}

export const rdf2csvw: CommandModule<
  CommonArgs,
  CommonArgs & {
    outDir: string;
    interactive: boolean;
    descriptor?: string;
    windowSize: number;
    useVocabMetadata: boolean;
  }
> = {
  command: 'rdf2csvw',
  aliases: ['r2c'],
  describe: 'Convert RDF to CSVW',
  builder: {
    interactive: {
      describe:
        'Interactive mode. Not available when reading streaming data from stdin.',
      type: 'boolean',
      implies: ['input'],
      default: false,
    },
    outDir: {
      alias: 'o',
      describe: 'Output directory.',
      type: 'string',
      coerce: resolve,
    },
    descriptor: {
      alias: 'd',
      describe: 'Path to a CSVW descriptor to be used during the conversion.',
      type: 'string',
    },
    windowSize: {
      describe:
        'How many triples to keep in memory when processing streaming data from stdin.',
      type: 'number',
      defaultDescription: '1000',
      conflicts: ['interactive', 'input'],
    },
    useVocabMetadata: {
      describe:
        'Use metadata from the vocabulary to enrich the conversion process. For example, `rdf:label`s of RDF properties can be used to provide more meaningful names for the generated columns.',
      type: 'boolean',
      default: true,
    },
  },
  handler: async (args: R2CArgs) => {
    if (args.interactive) {
      await interactiveOptions(args);
    } else {
      defaultOptions(args);
    }
    await handler(args);
  },
};

function defaultOptions(args: R2CArgs): void {
  args.outDir ??= process.cwd();
}

async function interactiveOptions(args: R2CArgs) {
  args.outDir ??= await input({
    message: 'Output directory [cwd]',
  });
  args.baseIri ??=
    (await input({
      message: `Base IRI for loading resources ${args.input ? '' : '[empty]'}`,
      default: '',
    })) || undefined;
  args.descriptor ??= await input({
    message:
      'URL or path to the CSVW descriptor file, which could be used to configure the conversion [empty]',
  });
}
