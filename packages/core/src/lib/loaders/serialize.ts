import { Quad, Stream } from '@rdfjs/types';
import N3, { StreamWriter } from 'n3';
import TurtleSerializer from '@rdfjs/serializer-turtle';
import PrefixMap from '@rdfjs/prefix-map/PrefixMap.js';
import { Readable } from 'readable-stream';
import { JsonLdSerializer } from 'jsonld-streaming-serializer';
import { lookupPrefixes } from './prefix-lookup.js';
import { n3Formats, RDFSerialization } from './rdf-serialization.js';
import { commonPrefixes } from '../utils/prefix.js';
import { rdfStreamToArray } from '../utils/stream-to-array.js';

const { namedNode } = N3.DataFactory;

export interface SerializeOptions {
  format: RDFSerialization;
  turtle?: TurtleOptions;
}

export type TurtleOptions = {
  base?: string;
  prefix?: Record<string, string>;
} & (
  | {
      prefixLookup?: boolean;
      streaming?: false;
    }
  | {
      prefixLookup?: false;
      streaming?: true;
    }
);

/**
 * Serializes RDF data to a given format.
 * @param stream - The stream of RDF quads to serialize.
 * @param options - The options to use for serialization.
 * @returns A promise that resolves to an event emitter.
 */
export async function serializeRdf(
  stream: Stream<Quad>,
  options: SerializeOptions,
): Promise<Readable | StreamWriter> {
  if (
    options.format === 'nquads' ||
    options.format === 'ntriples' ||
    options.format === 'turtle' ||
    options.format === 'trig'
  ) {
    if (
      (options.format === 'turtle' || options.format === 'trig') &&
      !options.turtle?.streaming
    ) {
      return nonstreamTurtle(stream, options);
    }
    const writer = new N3.StreamWriter({
      prefixes: options.turtle?.prefix ?? commonPrefixes,
      format: n3Formats[options.format],
    });
    writer.import(stream);
    return writer;
  }
  if (options.format === 'jsonld') {
    const writer = new JsonLdSerializer({ space: '  ' });
    stream.on('data', (quad) => writer.write(quad));
    stream.on('end', () => writer.end());
    stream.on('error', (err) => writer.emit('error', err));
    return writer;
  }
  throw new Error(`Unsupported format: ${options.format}`);
}

async function nonstreamTurtle(
  input: Stream<Quad>,
  options: SerializeOptions,
): Promise<Readable> {
  options.turtle ??= {};
  const quads = await rdfStreamToArray<Quad>(input);
  const prefixes = options.turtle.prefixLookup
    ? await lookupPrefixes(quads, options.turtle.prefix ?? commonPrefixes)
    : new PrefixMap(
        Object.entries(options.turtle.prefix ?? commonPrefixes).map(
          ([k, v]) => [k, namedNode(v)],
        ),
        { factory: N3.DataFactory },
      );

  const writer = new TurtleSerializer({
    baseIRI: options.turtle.base,
    prefixes,
  });
  const output = writer.transform(quads);
  const outputStream = new Readable();
  outputStream.push(output);
  outputStream.push(null);
  return outputStream;
}
