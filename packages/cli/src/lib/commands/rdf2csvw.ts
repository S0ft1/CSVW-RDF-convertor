import { CommandModule } from 'yargs';
import { CommonArgs } from '../common.js';
import { getPathOverrides } from './interactive/get-path-overrides.js';
import { readFileOrUrl } from '../utils/read-file-or-url.js';
import { resolve } from 'node:path';
import { getSchema } from './interactive/get-schema.js';

export const rdf2csvw: CommandModule<
  CommonArgs,
  (Omit<CommonArgs, 'input'> & {
    offline?: boolean;
    outDir: string;
  }) &
    (
      | { interactive?: boolean; input: string }
      | { interactive?: false; bufferSize: number }
    )
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
    },
    outDir: {
      alias: 'o',
      describe: 'Output directory',
      type: 'string',
      default: '.',
      coerce: resolve,
    },
    bufferSize: {
      describe:
        'How many triples to keep in memory when processing streaming data from stdin',
      type: 'number',
      defaultDescription: '1000',
      conflicts: ['interactive', 'input'],
    },
    offline: {
      describe: 'Do not fetch remote context files',
      type: 'boolean',
    },
  },
  handler: async (args) => {
    if (args.interactive) {
      const descriptor = JSON.parse(await readFileOrUrl(args.input));
      if (!args.pathOverrides) {
        args.pathOverrides = await getPathOverrides(descriptor);
      }
      getSchema([]);
    }
  },
};
