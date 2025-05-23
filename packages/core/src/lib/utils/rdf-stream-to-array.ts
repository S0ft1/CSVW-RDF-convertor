import { Stream, Quad } from '@rdfjs/types';

/**
 * Converts a stream of RDF quads to an array of quads.
 * @param stream The RDF stream to convert to an array
 */
export function rdfStreamToArray(stream: Stream<Quad>): Promise<Quad[]> {
  const quads: Quad[] = [];
  return new Promise<Quad[]>((resolve, reject) => {
    stream.on('data', (quad: Quad) => {
      quads.push(quad);
    });
    stream.on('end', () => {
      resolve(quads);
    });
    stream.on('error', (error) => {
      reject(error);
    });
  });
}
