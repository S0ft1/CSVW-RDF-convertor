import { Stream, Quad } from '@rdfjs/types';
import { JsonLdParser } from 'jsonld-streaming-parser';
import { StreamParser } from 'n3';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { Readable } from 'readable-stream';

export interface ParseOptions {
  /** for network requests */
  baseIri?: string;
  resolveStreamFn: (
    url: string,
    baseIri: string,
  ) => Promise<ReadableStream<string>>;
}

/**
 * Parses RDF data from a given URL.
 * @param url - The URL of the RDF resource to parse.
 * @param options - The options to use for parsing.
 * @returns A promise that resolves to a stream of RDF quads.
 */
export async function parseRdf(
  url: string,
  options: ParseOptions,
): Promise<Stream<Quad>> {
  const baseIri = options.baseIri ?? '';
  const readableStream = await options.resolveStreamFn(url, baseIri);
  let parser: StreamParser | JsonLdParser | RdfXmlParser;
  if (url.match(/\.(rdf|xml)([?#].*)?$/)) {
    parser = new RdfXmlParser();
  } else if (url.match(/\.jsonld([?#].*)?$/)) {
    parser = new JsonLdParser();
  } else {
    // TODO: By default, N3.Parser parses a permissive superset of Turtle, TriG, N-Triples, and N-Quads. For strict compatibility with any of those languages, pass a format argument upon creation.
    parser = new StreamParser<any>();
  }
  return parser.import(Readable.from(readableStream));
}
