import { CommonArgs } from '../common.js';
import { getPathOverrides } from './interactive/get-path-overrides.js';
import { getSchema } from './interactive/get-schema.js';
import { readFileOrUrl } from '../utils/read-file-or-url.js';

import {
  CsvwTableStreams,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  DescriptorWrapper,
  LogLevel,
  parseRdf,
  Rdf2CsvOptions,
  Rdf2CsvwConvertor,
  rdfToCsvw,
} from '@csvw-rdf-convertor/core';

import * as csv from 'csv';
import fs from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandModule } from 'yargs';
import { Readable } from 'node:stream';

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
    if (!args.input) throw new Error('stdin input not supported yet');
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
      baseIri: args.baseIri,
      pathOverrides: args.pathOverrides ?? [],
      logLevel:
        args.logLevel === 'debug'
          ? LogLevel.Debug
          : args.logLevel === 'warn'
            ? LogLevel.Warn
            : LogLevel.Error,
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
      }
    };

    let rdfStream = await parseRdf(args.input, {
		baseIri: args.baseIri, resolveStreamFn(path, base) {
			const url =
				URL.parse(path, base)?.href ??
				URL.parse(path)?.href ??
				resolve(base, path);
			if (
				!isAbsolute(url) &&
				(URL.canParse(url) || URL.canParse(url, base))
			) {
				if (url.startsWith('file:')) {
					return Promise.resolve(
						Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8'))
					);
				}
				return defaultResolveStreamFn(url, base);
			}
			return Promise.resolve(
				Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8'))
			);
		},
	});
    let streams: CsvwTableStreams;
    let descriptor: DescriptorWrapper;
    [streams, descriptor] = await rdfToCsvw(rdfStream, options)

    if (args.outDir) await mkdir(args.outDir, { recursive: true });

    for (const [tableName, [columns, stream]] of Object.entries(streams)) {
      const outputStream = args.outDir
        ? fs.createWriteStream(resolve(args.outDir, tableName))
        : process.stdout;

      const normalizedDescriptor = descriptor?.descriptor ?? {};
      const dialect = normalizedDescriptor.dialect ?? {};
      const descriptorOptions = {
        header: dialect.header ?? true,
        columns: columns.map((column) => ({
          key: column.queryVariable,
          header: column.title,
        })),
        ...(dialect.delimiter !== undefined && {
          delimiter: dialect.delimiter,
        }),
        ...(dialect.doubleQuote !== undefined && {
          escape: dialect.doubleQuote ? '"' : '\\',
        }),
        ...(dialect.quoteChar !== undefined &&
          dialect.quoteChar !== null && { quote: dialect.quoteChar }),
      };
      const stringifier = csv.stringify(descriptorOptions);
      stringifier.pipe(outputStream);
      // TODO: Streams are not consumed in parallel so the tables are not mixed when printing to stdout,
      // but it would improve performance when saving into multiple files.
      // TODO: Should the tables be divided by empty line when printing to stdout? Do we even want to support stdout?
      if (!args.outDir) console.log();

      for await (const bindings of stream as any) {
        const row = {} as { [key: string]: string };
        for (const [key, value] of bindings) {
          row[key.value] = value.value;
        }
        stringifier.write(row);
      }
    }
  },
};
