import { CommonArgs } from '../common.js';
import { getPathOverrides } from './interactive/get-path-overrides.js';
import { getSchema } from './interactive/get-schema.js';
import { readFileOrUrl } from '../utils/read-file-or-url.js';

import {
  defaultResolveJsonldFn,
  Rdf2CsvOptions,
  Rdf2CsvwConvertor,
} from '@csvw-rdf-convertor/core';

import * as csv from 'csv';
import { dirname, isAbsolute, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Bindings, ResultStream } from '@rdfjs/types';
import { fileURLToPath } from 'node:url';
import { CommandModule } from 'yargs';

export const rdf2csvw: CommandModule<
  CommonArgs,
  CommonArgs & {
    outDir: string;
    interactive?: boolean;
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
      baseIri: args.baseIri ?? dirname(args.input),
      pathOverrides: Object.entries(args.pathOverrides ?? {}),
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

    // TODO: use RDF data stream instead of file content
    let streams: { [key: string]: ResultStream<Bindings> };
    if (args.descriptor === undefined) {
      streams = await convertor.convert(await readFile(args.input, 'utf-8'));
    } else {
      streams = await convertor.convert(
        await readFile(args.input, 'utf-8'),
        (await options.resolveJsonldFn?.(args.descriptor, '')) ?? ''
      );
    }

    // TODO: save as CSV
    for (const [table, stream] of Object.entries(streams)) {
      console.log('---', table, '---');
      for await (const bindings of stream) {
        console.log(JSON.stringify(bindings.entries));
      }
    }
  },
};
