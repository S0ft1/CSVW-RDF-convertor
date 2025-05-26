import { CommonArgs } from '../common.js';
import { getPathOverrides } from './interactive/get-path-overrides.js';
import { getSchema } from './interactive/get-schema.js';
import { readFileOrUrl } from '../utils/read-file-or-url.js';

import {
  defaultResolveJsonldFn,
  LogLevel,
  normalizeDescriptor,
  Rdf2CsvOptions,
  Rdf2CsvwConvertor,
} from '@csvw-rdf-convertor/core';

import * as csv from 'csv';
import fs from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { Bindings, ResultStream } from '@rdfjs/types';
import { fileURLToPath } from 'node:url';
import { CommandModule } from 'yargs';
import { CsvLocationTracker, IssueTracker, findFormatedColumns, transformNumber } from '@csvw-rdf-convertor/core';
export const rdf2csvw: CommandModule<
  CommonArgs,
  CommonArgs & {
    outDir: string;
    interactive?: boolean;
    descriptor?: string;
    bufferSize: number;
    baseIri: string;
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
    baseIri: {
      describe: 'Base IRI for relative quad IRIs',
      type: 'string',
      defaultDescription: 'The path to the input file',
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
      baseIri: args.baseIri ?? dirname(args.input),
      pathOverrides: args.pathOverrides,
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
      },
    };
    const convertor = new Rdf2CsvwConvertor(options);

    // TODO: use RDF data stream instead of file content
    let streams: { [key: string]: [string[], ResultStream<Bindings>] };
    let descriptor = '';
      if (args.descriptor) {
      descriptor = await options.resolveJsonldFn?.(args.descriptor, '') ?? '';
      }
    if (args.descriptor === undefined) {
      streams = await convertor.convert(await readFile(args.input, 'utf-8'));
    } else {
      streams = await convertor.convert(
        await readFile(args.input, 'utf-8'),
        descriptor
      );
    }

    for (const [tableName, [columnNames, stream]] of Object.entries(streams)) {
      if (args.outDir) await mkdir(args.outDir, { recursive: true });

      const outputStream = args.outDir
        ? fs.createWriteStream(resolve(args.outDir, tableName))
        : process.stdout;

      // TODO: Set delimiter and other properties according to descriptor
      const stringifier = csv.stringify({ header: true, columns: columnNames });
      stringifier.pipe(outputStream);

      // TODO: Streams are not consumed in parallel so the tables are not mixed when printing to stdout,
      // but it would improve performance when saving into multiple files.
      // TODO: Should the tables be divided by empty line when printing to stdout? Do we even want to support stdout?

      const fakeIssueTracker = new IssueTracker(new CsvLocationTracker(), {});
      const opt: Required<Rdf2CsvOptions> = setDefaults({});
      const descrWrapper = await normalizeDescriptor(descriptor, opt, fakeIssueTracker)
      for await (const bindings of stream) {
        const row = {} as { [key: string]: string };
        // TODO: value transformations
        for (const [key, value] of bindings) {
          const colums = descrWrapper.descriptor.tableSchema?.columns;
          if (colums) {
            const formatedColumns = findFormatedColumns(colums);
            if (formatedColumns.length === 0) {
              row[key.value] = value.value;
            }
            else {
              for (const column of formatedColumns) {
                if (column.name && column.name === key.value) {
                  row[key.value] = transformNumber(value.value, column, fakeIssueTracker);
                }
                else {
                  row[key.value] = value.value;
                }
              }
            }

          }
        }
        stringifier.write(row);
      }
    }
  },
};

//this is here only to create fake issue tracker
function setDefaults(options?: Rdf2CsvOptions): Required<Rdf2CsvOptions> {
  options ??= {};
  return {
    pathOverrides: options.pathOverrides ?? [],
    baseIri: options.baseIri ?? '',
    logLevel: options.logLevel ?? LogLevel.Warn,
    resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveJsonldFn,
    descriptorNotProvided: options.descriptorNotProvided ?? false,
  };
}