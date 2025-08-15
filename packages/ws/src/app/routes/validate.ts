import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  Csvw2RdfOptions,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
  Issue,
  validateCsvwFromUrl,
  validateCsvwFromDescriptor,
} from '@csvw-rdf-convertor/core';
import { makeRe, MMRegExp } from 'minimatch';
import { resolve } from 'node:path';
import os from 'node:os';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { file as tmpFile } from 'tmp-promise';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/validate',
    {
      schema: {
        description: 'Validate CSVW',
        tags: ['validate'],
        summary: 'Validate CSVW',
        body: {
          type: 'object',
          properties: {
            options: {
              type: 'object',
              properties: {
                input: {
                  type: 'string',
                  description:
                    'URL of either the CSV file or the CSVW descriptor. Can also be a filename of an uploaded file.',
                },
                pathOverrides: {
                  type: 'object',
                  description:
                    'Record of path overrides where the key is a pattern and the value is the replacement. The pattern will be interpreted as a minimatch pattern.',
                  additionalProperties: { type: 'string' },
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
        response: {
          200: {
            description: 'Stream of validation issues in NDJSON format',
            content: {
              'application/x-ndjson': {
                schema: {
                  type: 'string',
                  description:
                    'Each line is a JSON object representing an issue.',
                },
              },
            },
          },
        },
      },
    },
    async function (req, res) {
      const options = getOptions(req);
      let stream: AsyncIterable<Issue>;
      const input = (req.body as any).options.input;
      if (input.match(/\.csv([?#].*)?$/)) {
        stream = validateCsvwFromUrl(input, options);
      } else {
        const descriptorText =
          (await options.resolveJsonldFn?.(input, '')) ?? '';
        const descriptor = JSON.parse(descriptorText);
        stream = validateCsvwFromDescriptor(descriptor, {
          ...options,
          originalUrl: input,
        });
      }

      const tmp = await tmpFile();
      const ws = createWriteStream(tmp.path, { fd: tmp.fd, encoding: 'utf-8' });

      for await (const issue of stream) {
        ws.write(JSON.stringify(issue) + '\n');
      }

      const outStream = createReadStream(tmp.path, {
        fd: tmp.fd,
        encoding: 'utf-8',
      });
      outStream.on('close', () => tmp.cleanup());
      res.type('application/x-ndjson');
      return res.send(outStream);
    },
  );
}

function getOptions(req: FastifyRequest): Csvw2RdfOptions {
  const options = (req.body as any).options;
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  const getFileFromBody = (url: string) => {
    const file = (req.body as any)[url];
    return 'filename' in file ? resolve(os.tmpdir(), file.filename) : undefined;
  };
  return {
    baseIri: options.baseIri ?? options.input,
    pathOverrides: Object.entries(options.pathOverrides ?? {}).map(([o, p]) => {
      const res = [makeRe(o) || o, p] as [string | RegExp, string];
      if (res[0] instanceof RegExp) {
        (res[0] as MMRegExp)._glob = o;
      }
      return res;
    }),
    minimal: true,
    templateIris: false,
    resolveCsvStreamFn: async (url, base) => {
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
    resolveWkfFn: async (url, base) => {
      url = getUrl(url, base);
      const file = getFileFromBody(url);
      if (file) return readFile(file, 'utf-8');
      return defaultResolveTextFn(url, base);
    },
  };
}
