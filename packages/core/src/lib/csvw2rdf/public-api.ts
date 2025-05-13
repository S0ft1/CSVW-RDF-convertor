import { Quad, Stream } from '@rdfjs/types';
import { AnyCsvwDescriptor } from '../types/descriptor/descriptor.js';
import { Csvw2RdfOptions } from '../conversion-options.js';
import { Csvw2RdfConvertor } from './convertor.js';

export function csvwDescriptorToRdf(
  descriptor: string | AnyCsvwDescriptor,
  options: Csvw2RdfOptions & { originalUrl?: string }
): Stream<Quad> {
  const convertor = new Csvw2RdfConvertor(options);
  return convertor.convert(descriptor, options.originalUrl);
}
export function csvUrlToRdf(
  url: string,
  options: Csvw2RdfOptions
): Stream<Quad> {
  const convertor = new Csvw2RdfConvertor(options);
  return convertor.convertFromCsvUrl(url);
}
