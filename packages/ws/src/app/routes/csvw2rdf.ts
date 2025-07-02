import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  commonPrefixes,
  csvUrlToRdf,
  Csvw2RdfOptions,
  csvwDescriptorToRdf,
  customPrefix,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
  Issue,
  n3Formats,
  RDFSerialization,
  ValidationError,
} from '@csvw-rdf-convertor/core';
import { makeRe, MMRegExp } from 'minimatch';
import { resolve } from 'node:path';
import os from 'node:os';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { Quad, Stream } from '@rdfjs/types';
import { file as tmpFile } from 'tmp-promise';
import N3, { DataFactory } from 'n3';
import { once } from 'node:events';

const { quad, namedNode, literal } = DataFactory;

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/csvw2rdf',
    {
      schema: {
        description: 'Convert CSVW to RDF',
        tags: ['csvw2rdf'],
        summary: 'Convert CSVW to RDF',
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
                minimal: {
                  type: 'boolean',
                  description:
                    'Use minimal conversion mode. Defaults to false.',
                },
                templateIris: {
                  type: 'boolean',
                  description:
                    'Use template IRIs instead of URIs. Defaults to false.',
                },
                baseIri: {
                  type: 'string',
                  description:
                    'Base IRI for loading resources. Defaults to the URL of the CSVW descriptor.',
                },
                format: {
                  type: 'string',
                  description: 'Output RDF serialization. Defaults to turtle.',
                  enum: ['nquads', 'ntriples', 'turtle', 'trig'],
                },
                includeWarnings: {
                  type: 'boolean',
                  description:
                    'Include warnings in the output. Defaults to false.',
                },
                turtle: {
                  type: 'object',
                  description:
                    'Options for the turtle serialization. Only used if format is turtle.',
                  properties: {
                    prefixes: {
                      type: 'object',
                      description:
                        'Record of prefixes where the key is the prefix and the value is the IRI.',
                      additionalProperties: { type: 'string' },
                    },
                  },
                  additionalProperties: false,
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
      const options = getOptions(req);
      let stream: Stream<Quad>;
      const input = (req.body as any).options.input;
      const tmp = await tmpFile();
      if (input.match(/\.csv([?#].*)?$/)) {
        stream = csvUrlToRdf(input, options);
      } else {
        const descriptorText =
          (await options.resolveJsonldFn?.(input, '')) ?? '';
        const descriptor = JSON.parse(descriptorText);
        stream = csvwDescriptorToRdf(descriptor, {
          ...options,
          originalUrl: input,
        });
      }

      const format: RDFSerialization =
        (req.body as any).options.format ?? 'turtle';
      const prefixes =
        (req.body as any).options.turtle?.prefix ?? commonPrefixes;
      res.type(n3Formats[format]);
      const includeWarnings: boolean =
        (req.body as any).options.includeWarnings ?? false;

      try {
        const writer = new N3.Writer(
          createWriteStream(tmp.path, { fd: tmp.fd, encoding: 'utf-8' }),
          {
            prefixes,
            format: n3Formats[format],
          }
        );
        if (includeWarnings) {
          stream.on('warning', (warning) => {
            outputWarning(warning, writer);
          });
        }
        stream.on('error', (error) => {
          throw error;
        });
        stream.on('data', (data) => {
          writer.addQuad(data);
        });
        await once(stream, 'end');
        writer.end();
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

      const outStream = createReadStream(tmp.path, {
        encoding: 'utf-8',
      });
      outStream.on('close', () => {
        tmp.cleanup();
      });
      res.type(n3Formats[format]);
      return res.send(outStream);
    }
  );
}

function outputWarning(message: Issue, writer: N3.Writer) {
  const props = [
    {
      predicate: namedNode(commonPrefixes.dcterms + 'description'),
      object: literal(message.message, 'en') as
        | N3.Literal
        | N3.BlankNode
        | N3.NamedNode,
    },
  ];
  if (message.location) {
    for (const [key, value] of Object.entries(message.location)) {
      props.push({
        predicate: namedNode(customPrefix + key),
        object:
          typeof value === 'string'
            ? namedNode(value)
            : literal(value, commonPrefixes.xsd + 'integer'),
      });
    }
  }

  writer.addQuad(
    quad(
      writer.blank(props),
      namedNode(commonPrefixes.rdf + 'type'),
      namedNode(customPrefix + 'Warning')
    )
  );
}

function getOptions(req: FastifyRequest): Csvw2RdfOptions {
  const options = (req.body as any).options;
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  const getFileFromBody = (url: string) => {
    const file = (req.body as any)[url];
    return file && 'filename' in file
      ? resolve(os.tmpdir(), file.filename)
      : undefined;
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
    minimal: options.minimal ?? false,
    templateIris: options.templateIris ?? false,
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
