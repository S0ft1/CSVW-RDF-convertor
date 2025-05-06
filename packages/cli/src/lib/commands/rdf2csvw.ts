import { CommandModule } from 'yargs';
import { CommonArgs } from '../common.js';
import { getPathOverrides } from './interactive/get-path-overrides.js';
import { readFileOrUrl } from '../utils/read-file-or-url.js';
import { isAbsolute, resolve } from 'node:path';
import { getSchema } from './interactive/get-schema.js';
import {
  defaultResolveJsonldFn,
  Rdf2CsvOptions,
  Rdf2CsvwConvertor,
} from '@csvw-rdf-convertor/core';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

export const rdf2csvw: CommandModule<
  CommonArgs,
  CommonArgs & {
    offline?: boolean;
    outDir: string;
    interactive?: boolean;
    input: string;
    descriptor?: string;
    bufferSize: number;
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
    },
    outDir: {
      alias: 'o',
      describe: 'Output directory',
      type: 'string',
      default: '.',
      coerce: resolve,
    },
    descriptor: {
      alias: 'd',
      describe: 'CSVW descriptor',
      type: 'string',
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

    if (args.input === undefined)
      throw new Error('stdin input not supported yet');

    const options: Rdf2CsvOptions = {
      resolveJsonldFn: async (path, base) => {
        const url =
          URL.parse(path, base)?.href ??
          URL.parse(path)?.href ??
          resolve(base, path);
        if (!isAbsolute(url) && URL.canParse(url)) {
          if (url.startsWith('file:')) {
            return readFile(fileURLToPath(url), 'utf-8');
          }
          return defaultResolveJsonldFn(url, base);
        }

        return await readFile(url, 'utf-8');
      },
    };
    const convertor = new Rdf2CsvwConvertor(options);

    if (args.descriptor === undefined) {
      convertor.convert(args.input);
    } else {
      convertor.convert(
        args.input,
        (await options.resolveJsonldFn?.(args.descriptor, '')) ?? ''
      );
    }
  },
};
