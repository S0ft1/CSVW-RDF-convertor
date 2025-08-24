import { Stream } from '@rdfjs/types';
import { Readable } from 'readable-stream';

/**
 * Converts a stream to an array.
 * @param stream The stream to convert to an array
 */
export function rdfStreamToArray<T>(stream: Readable | Stream): Promise<T[]> {
  const chunks: T[] = [];
  return new Promise<T[]>((resolve, reject) => {
    stream.on('data', (chunk: T) => {
      chunks.push(chunk);
    });
    stream.on('end', () => {
      resolve(chunks);
    });
    stream.on('error', (error: any) => {
      reject(error);
    });
  });
}
