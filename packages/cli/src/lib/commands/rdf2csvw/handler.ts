import { R2CArgs } from './command.js';
import {
  AnyCsvwDescriptor,
  CsvwResultItem,
  CsvwTableGroupDescription,
  rdfToTableSchema,
  TableGroupSchema,
} from '@csvw-rdf-convertor/core';

import {
  CompactedCsvwDescriptor,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  LogLevel,
  parseRdf,
  Rdf2CsvOptions,
  rdfToCsvw,
} from '@csvw-rdf-convertor/core';

import * as csv from 'csv';
import fs, { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { getPathOverrides } from '../interactive/get-path-overrides.js';
import { getSchema } from '../interactive/get-schema.js';
import { once } from 'node:events';

export async function handler(args: R2CArgs): Promise<void> {
  const options = await argsToOptions(args);
  const rdfStream = await parseRdf(args.input || '', {
    baseIri: options.baseIri!,
    resolveStreamFn: args.input
      ? options.resolveRdfFn!
      : async () => Readable.toWeb(process.stdin),
  });
  let schema = args.input
    ? ((options.descriptor as CompactedCsvwDescriptor | undefined) ??
      (await rdfToTableSchema(
        await parseRdf(args.input, {
          baseIri: options.baseIri!,
          resolveStreamFn: options.resolveRdfFn!,
        }),
        options,
      )))
    : undefined;

  if (args.interactive) {
    if (args.descriptor) {
      args.pathOverrides ??= await getPathOverrides(options.descriptor);
    } else {
      args.pathOverrides ??= await getPathOverrides({});
      if (!(schema instanceof TableGroupSchema)) {
        schema = TableGroupSchema.fromDescriptor(schema as any);
      }
      schema = await getSchema(schema as TableGroupSchema);
    }
  }

  const stream = rdfToCsvw(rdfStream, {
    ...options,
    descriptor: schema as AnyCsvwDescriptor | TableGroupSchema | undefined,
  });

  await mkdir(args.outDir, { recursive: true });
  await saveToOutdir(stream, args.outDir);
}

async function argsToOptions(args: R2CArgs): Promise<Rdf2CsvOptions> {
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  const opts: Rdf2CsvOptions = {
    baseIri: args.baseIri,
    pathOverrides: args.pathOverrides ?? [],
    logLevel:
      args.logLevel === 'debug'
        ? LogLevel.Debug
        : args.logLevel === 'warn'
          ? LogLevel.Warn
          : LogLevel.Error,
    resolveJsonldFn: async (path, base) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && URL.canParse(url)) {
        if (url.startsWith('file:')) {
          return readFile(fileURLToPath(url), 'utf-8');
        }
        return defaultResolveJsonldFn(url, base);
      }
      return await readFile(url, 'utf-8');
    },
    resolveRdfFn: (path, base) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
        if (url.startsWith('file:')) {
          return Promise.resolve(
            Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8')),
          );
        }
        return defaultResolveStreamFn(url, base);
      }
      return Promise.resolve(
        Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8')),
      );
    },
    useVocabMetadata: args.useVocabMetadata,
    windowSize: args.windowSize,
  };

  if (args.descriptor) {
    opts.descriptor = JSON.parse(
      await opts.resolveJsonldFn!(args.descriptor, args.baseIri!),
    );
  }

  return opts;
}

async function saveToOutdir(
  stream: AsyncIterable<CsvwResultItem>,
  outdir: string,
) {
  const outStreams: Record<string, csv.stringifier.Stringifier> = {};
  const tableOptions: Record<string, csv.stringifier.Options> = {};
  let latestDescriptor: CompactedCsvwDescriptor;
  for await (const { descriptor, table, row } of stream) {
    latestDescriptor = descriptor;
    let outStream = outStreams[table.name];
    if (!outStream) {
      const filePath = join(outdir, table.name.replace(/\/\\:/g, '_'));
      const [hasHeader, options] = getDialect(descriptor, table.name);
      tableOptions[table.name] = options;
      outStreams[table.name] = outStream = csv.stringify(options);
      outStream.pipe(createWriteStream(filePath, 'utf-8'));

      if (hasHeader) outStream.write(table.columns);
    }
    outStream.write(table.columns.map((c) => row[c] ?? ''));
  }
  await writeFile(
    join(outdir, 'descriptor.json'),
    JSON.stringify(latestDescriptor!),
  );
  const ends: Promise<any>[] = [];
  for (const s of Object.values(outStreams)) {
    ends.push(once(s, 'finish'));
    s.end();
  }
  await Promise.all(ends);
}

function getDialect(
  descriptor: CompactedCsvwDescriptor,
  table: string,
): [boolean, csv.stringifier.Options] {
  const dialect = descriptor.dialect ?? {};
  const tableDialect =
    (descriptor as CsvwTableGroupDescription).tables.find(
      (t) => t.url === table,
    )?.dialect ?? {};

  const hasHeader = tableDialect.header ?? dialect.header ?? true;
  const toArr = (val: any) => (Array.isArray(val) ? val : [val]);

  return [
    hasHeader,
    {
      delimiter: dialect.delimiter ?? ',',
      escape: (dialect.doubleQuote ?? true) ? '"' : '\\',
      record_delimiter: dialect.lineTerminators
        ? toArr(dialect.lineTerminators)[0]
        : '\n',
      quote: dialect.quoteChar ?? '"',
    },
  ];
}
