import { Quad, Stream } from '@rdfjs/types';
import { AnyCsvwDescriptor } from '../types/descriptor/descriptor.js';
import { Csvw2RdfOptions } from '../conversion-options.js';
import { Csvw2RdfConvertor } from './convertor.js';

/**
 * Converts CSVW to RDF from a descriptor.
 * @param descriptor descriptor either as parsed or stringified JSON
 * @param options conversion options
 * @returns a stream of RDF quads
 */
export function csvwDescriptorToRdf(
  descriptor: string | AnyCsvwDescriptor,
  options: Csvw2RdfOptions & { originalUrl?: string }
): Stream<Quad> {
  const convertor = new Csvw2RdfConvertor(options);
  return convertor.convert(descriptor, options.originalUrl);
}

/**
 * Converts a CSVW to RDF from a CSV file URL.
 * @param url URL of the CSV file
 * @param options conversion options
 * @returns a stream of RDF quads
 */
export function csvUrlToRdf(
  url: string,
  options: Csvw2RdfOptions
): Stream<Quad> {
  const convertor = new Csvw2RdfConvertor(options);
  return convertor.convertFromCsvUrl(url);
}
