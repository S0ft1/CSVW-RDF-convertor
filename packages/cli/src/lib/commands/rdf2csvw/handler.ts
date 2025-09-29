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
  LogLevel,
  parseRdf,
  Rdf2CsvOptions,
  rdfToCsvw,
} from '@csvw-rdf-convertor/core';

import * as csv from 'csv';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { getPathOverrides } from '../interactive/get-path-overrides.js';
import { getSchema } from '../interactive/get-schema.js';
import { once } from 'node:events';
import { resolveJson, resolveTextStream } from '../../resolvers.js';

export async function handler(args: R2CArgs): Promise<void> {
  console.log('Converting RDF to CSV-W...', args);
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
  console.log(`Saving CSV-W files to ${args.outDir}...`);
  await saveToOutdir(stream, args.outDir);
  console.log(`CSV-W files saved to ${args.outDir}`);
}

async function argsToOptions(args: R2CArgs): Promise<Rdf2CsvOptions> {
  const opts: Rdf2CsvOptions = {
    baseIri:
      args.baseIri ??
      (args.input && URL.canParse(args.input) && !isAbsolute(args.input)
        ? args.input
        : dirname(resolve(process.cwd(), args.input ?? ''))),
    pathOverrides: args.pathOverrides ?? [],
    logLevel:
      args.logLevel === 'debug'
        ? LogLevel.Debug
        : args.logLevel === 'warn'
          ? LogLevel.Warn
          : LogLevel.Error,
    resolveJsonldFn: resolveJson,
    resolveRdfFn: resolveTextStream,
    useVocabMetadata: args.useVocabMetadata,
    windowSize: args.windowSize,
  };

  if (args.descriptor) {
    opts.descriptor = JSON.parse(
      await opts.resolveJsonldFn!(args.descriptor, opts.baseIri!),
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
    console.log(`Processing table: ${table.name}`);
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
    JSON.stringify(latestDescriptor!, null, '  ') ?? '',
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
    (descriptor as CsvwTableGroupDescription).tables?.find(
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
