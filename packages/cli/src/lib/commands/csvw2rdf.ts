import { CommandModule } from 'yargs';
import { CommonArgs } from '../common.js';
import {
  commonPrefixes,
  Csvw2RdfConvertor,
  Csvw2RdfOptions,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  RDFSerialization,
} from '@csvw-rdf-convertor/core';
import N3 from 'n3';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Quad, Stream } from '@rdfjs/types';

export const csvw2rdf: CommandModule<
  CommonArgs,
  CommonArgs & {
    format?: RDFSerialization;
    output?: string;
    minimal?: boolean;
    templateIris?: boolean;
  }
> = {
  command: 'csvw2rdf',
  aliases: ['c2r'],
  describe: 'Convert CSVW to RDF',
  builder: {
    format: {
      describe: 'Output RDF serialization',
      choices: ['nquads', 'ntriples', 'turtle', 'trig'],
      defaultDescription:
        'Tries to infer the format from the output file extension, otherwise defaults to turtle',
    },
    output: {
      alias: 'o',
      describe: 'Output file',
      type: 'string',
      defaultDescription: 'Prints to stdout',
    },
    minimal: {
      describe: 'Use minimal output',
      type: 'boolean',
    },
    templateIris: {
      describe: 'Use template IRIs instead of URIs',
      type: 'boolean',
    },
  },
  handler: async (args) => {
    args.format = args.format ?? inferFormat(args.output);
    const options: Csvw2RdfOptions = {
      baseIri: args.baseIri ?? args.input,
      minimal: args.minimal,
      templateIRIs: args.templateIris,
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
      resolveCsvStreamFn: (path, base) => {
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
    };
    if (args.input === undefined)
      throw new Error('stdin input not supported yet');
    const convertor = new Csvw2RdfConvertor(options);
    let stream: Stream<Quad>;
    if (args.input.match(/\.csv([?#].*)?$/)) {
      stream = await convertor.convertFromCsvUrl(args.input);
    } else {
      stream = await convertor.convert(
        (await options.resolveJsonldFn?.(args.input, '')) ?? '',
        args.input
      );
    }

    const writer = new N3.StreamWriter({
      prefixes: commonPrefixes,
      format: n3Formats[args.format],
    });
    const outputStream = args.output
      ? fs.createWriteStream(args.output)
      : process.stdout;
    writer.import(stream);
    writer.pipe(outputStream);
  },
};

const n3Formats: Record<RDFSerialization, string> = {
  jsonld: 'text/turtle',
  nquads: 'application/n-quads',
  ntriples: 'application/n-triples',
  rdfxml: 'text/turtle',
  trig: 'application/trig',
  turtle: 'text/turtle',
};

function inferFormat(output?: string): RDFSerialization {
  if (!output) return 'turtle';
  const ext = output.split('.').pop();
  switch (ext) {
    case 'json':
      return 'jsonld';
    case 'nq':
      return 'nquads';
    case 'nt':
      return 'ntriples';
    case 'xml':
      return 'rdfxml';
    case 'trig':
      return 'trig';
    case 'ttl':
    default:
      return 'turtle';
  }
}
