import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  ValidationError,
  Rdf2CsvOptions,
  parseRdf,
  rdfToCsvw,
  CsvwResultItem,
  CompactedCsvwDescriptor,
  CsvwTableGroupDescription,
} from '@csvw-rdf-convertor/core';
import { makeRe, MMRegExp } from 'minimatch';
import { join, resolve } from 'node:path';
import os from 'node:os';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { DirectoryResult, dir as tmpDir } from 'tmp-promise';
import { Options, Stringifier, stringify } from 'csv-stringify';
import archiver from 'archiver';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/rdf2csvw',
    {
      schema: {
        description: 'Convert RDF to CSVW',
        tags: ['rdf2csvw'],
        summary: 'Convert RDF to CSVW',
        body: {
          type: 'object',
          properties: {
            options: {
              type: 'object',
              properties: {
                input: {
                  type: 'string',
                  description:
                    'URL of the input RDF. Can also be a filename of an uploaded file.',
                },
                descriptor: {
                  type: 'string',
                  description:
                    'Optional URL of the CSVW descriptor to be used. Can also be a filename of an uploaded file.',
                },
                pathOverrides: {
                  type: 'object',
                  description:
                    'Record of path overrides where the key is a pattern and the value is the replacement. The pattern will be interpreted as a minimatch pattern.',
                  additionalProperties: { type: 'string' },
                },
                useVocabMetadata: {
                  type: 'boolean',
                  description:
                    'Use metadata from the vocabulary to enrich the conversion process. For example, `rdf:label`s of RDF properties can be used to provide more meaningful names for the generated columns. Defaults to true.',
                },
                baseIri: {
                  type: 'string',
                  description:
                    'Base IRI for loading resources. Defaults to the URL of the CSVW descriptor.',
                },
              },
              required: ['input'],
              additionalProperties: false,
            },
          },
          required: ['options'],
        },
      },
    },
    async function (req, res) {
      const options = await getOptions(req);
      const input = await parseRdf((req.body as any).options.input, {
        resolveStreamFn: options.resolveRdfFn!,
        baseIri: options.baseIri,
      });
      const resultStream = rdfToCsvw(input, options);
      const tmp = await tmpDir();

      try {
        await saveToTemp(resultStream, tmp);
      } catch (error) {
        if (error instanceof ValidationError) {
          res.status(422).send(error);
        } else {
          res.status(500).send({
            error: 'Internal Server Error',
          });
          console.error('Error during conversion:', error);
        }
        await tmp.cleanup();
        return;
      }

      res.type('application/zip');
      const archive = archiver('zip');
      archive.finalize().then(() => {
        tmp.cleanup();
      });
      archive.directory(tmp.path, false);
      return res.send(archive);
    },
  );
}

async function saveToTemp(
  stream: AsyncIterable<CsvwResultItem>,
  tmp: DirectoryResult,
) {
  const outStreams: Record<string, Stringifier> = {};
  const tableOptions: Record<string, Options> = {};
  let latestDescriptor: CompactedCsvwDescriptor;
  for await (const { descriptor, table, row } of stream) {
    latestDescriptor = descriptor;
    let outStream = outStreams[table.name];
    if (!outStream) {
      const filePath = join(tmp.path, table.name.replace(/\/\\:/g, '_'));
      const [hasHeader, options] = getDialect(descriptor, table.name);
      tableOptions[table.name] = options;
      outStreams[table.name] = outStream = stringify(options);
      outStream.pipe(createWriteStream(filePath, 'utf-8'));

      if (hasHeader) outStream.write(table.columns);
    }
    outStream.write(table.columns.map((c) => row[c] ?? ''));
  }
  await writeFile(
    join(tmp.path, 'descriptor.json'),
    JSON.stringify(latestDescriptor!),
  );
  const ends: Promise<any>[] = [];
  for (const s of Object.values(outStreams)) {
    ends.push(once(s, 'finish'));
    s.end();
  }
  await Promise.all(ends);
}

async function getOptions(req: FastifyRequest): Promise<Rdf2CsvOptions> {
  const options = (req.body as any).options;
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  const getFileFromBody = (url: string) => {
    const file = (req.body as any)[url];
    return file && 'filename' in file
      ? resolve(os.tmpdir(), file.filename)
      : undefined;
  };
  const result: Rdf2CsvOptions = {
    baseIri: options.baseIri ?? options.input,
    pathOverrides: Object.entries(options.pathOverrides ?? {}).map(([o, p]) => {
      const res = [makeRe(o) || o, p] as [string | RegExp, string];
      if (res[0] instanceof RegExp) {
        (res[0] as MMRegExp)._glob = o;
      }
      return res;
    }),
    useVocabMetadata: options.useVocabMetadata ?? true,
    resolveRdfFn: async (url, base) => {
      url = getUrl(url, base);
      const file = getFileFromBody(url);
      if (file) return Readable.toWeb(createReadStream(file, 'utf-8'));
      return defaultResolveStreamFn(url, base);
    },
    resolveJsonldFn: (url, base) => {
      url = getUrl(url, base);
      const file = getFileFromBody(url);
      if (file) return readFile(file, 'utf-8');
      return defaultResolveJsonldFn(url, base);
    },
    windowSize: 1000,
  };

  if (options.descriptor) {
    result.descriptor = await result.resolveJsonldFn!(
      options.descriptor,
      result.baseIri!,
    );
  }

  return result;
}

function getDialect(
  descriptor: CompactedCsvwDescriptor,
  table: string,
): [boolean, Options] {
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
