import { C2RArgs, TurtleOptions } from './command.js';
import {
  csvwDescriptorToRdf,
  csvUrlToRdf,
  Csvw2RdfOptions,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  lookupPrefixes,
  rdfStreamToArray,
} from '@csvw-rdf-convertor/core';
import N3 from 'n3';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Quad, Stream } from '@rdfjs/types';
import { RDFSerialization } from 'src/lib/rdf-serialization.js';
import TurtleSerializer from '@rdfjs/serializer-turtle';
import PrefixMap from '@rdfjs/prefix-map/PrefixMap.js';

const { namedNode } = N3.DataFactory;

export type ArgsWithDefaults = C2RArgs &
  Required<Pick<C2RArgs, 'turtle' | 'format'>> & {
    turtle: Required<Pick<TurtleOptions, 'prefix'>>;
  };

export async function handler(args: ArgsWithDefaults): Promise<void> {
  const options = getOptions(args);
  if (args.input === undefined) {
    args.input = await text(process.stdin);
  }
  let stream: Stream<Quad>;
  if (args.input.match(/\.csv([?#].*)?$/)) {
    stream = csvUrlToRdf(args.input, options);
  } else {
    stream = csvwDescriptorToRdf(
      (await options.resolveJsonldFn?.(args.input, '')) ?? '',
      { ...options, originalUrl: args.input }
    );
  }
  stream.on('warning', (warning) => {
    console.warn(warning);
  });
  const outputStream = args.output
    ? fs.createWriteStream(args.output)
    : process.stdout;

  if (
    (args.format === 'trig' || args.format === 'turtle') &&
    !args.turtle.streaming
  ) {
    await outputFormattedTurtle(args, stream, outputStream);
  } else {
    const writer = new N3.StreamWriter({
      prefixes: args.turtle.prefix,
      format: n3Formats[args.format],
    });
    writer.import(stream);
    writer.pipe(outputStream);
  }
}

function getOptions(args: C2RArgs): Csvw2RdfOptions {
  return {
    baseIRI: args.baseIri,
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
      if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
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
}

const n3Formats: Record<RDFSerialization, string> = {
  jsonld: 'text/turtle',
  nquads: 'application/n-quads',
  ntriples: 'application/n-triples',
  rdfxml: 'text/turtle',
  trig: 'application/trig',
  turtle: 'text/turtle',
};

async function outputFormattedTurtle(
  args: ArgsWithDefaults,
  input: Stream<Quad>,
  outputStream: NodeJS.WritableStream
) {
  const quads = await rdfStreamToArray(input);
  const prefixes = args.turtle.prefixLookup
    ? await lookupPrefixes(quads, args.turtle.prefix)
    : new PrefixMap(
        Object.entries(args.turtle.prefix).map(([k, v]) => [k, namedNode(v)]),
        { factory: N3.DataFactory }
      );

  const writer = new TurtleSerializer({
    baseIRI: args.turtle.base,
    prefixes,
  });
  const output = writer.transform(quads);
  outputStream.write(output);
}
