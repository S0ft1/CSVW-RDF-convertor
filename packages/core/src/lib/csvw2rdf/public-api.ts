import { Quad, Stream } from '@rdfjs/types';
import { AnyCsvwDescriptor } from '../types/descriptor/descriptor.js';
import { Csvw2RdfOptions } from '../conversion-options.js';
import { Csvw2RdfConvertor } from './convertor.js';
import { Issue, ValidationError } from '../utils/issue-tracker.js';
import { eventEmitterToAsyncIterable } from '../utils/event-emitter.js';

/**
 * Converts CSVW to RDF from a descriptor.
 * @param descriptor descriptor either as parsed or stringified JSON
 * @param options conversion options
 * @returns a stream of RDF quads
 */
export function csvwDescriptorToRdf(
  descriptor: string | AnyCsvwDescriptor,
  options: Csvw2RdfOptions & { originalUrl?: string },
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
  options: Csvw2RdfOptions,
): Stream<Quad> {
  const convertor = new Csvw2RdfConvertor(options);
  return convertor.convertFromCsvUrl(url);
}

/**
 * Validates CSVW from a descriptor.
 * @param descriptor descriptor either as parsed or stringified JSON
 * @param options validation options
 * @returns a stream of validation issues
 */
export async function* validateCsvwFromDescriptor(
  descriptor: string | AnyCsvwDescriptor,
  options: Csvw2RdfOptions & { originalUrl?: string },
): AsyncIterable<Issue> {
  try {
    yield* eventEmitterToAsyncIterable(
      csvwDescriptorToRdf(descriptor, { ...options, minimal: true }),
      'warning',
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      yield { type: 'error', message: error.message, location: error.location };
    } else {
      throw error;
    }
  }
}

/**
 * Validates CSVW from a CSV file URL.
 * @param url URL of the CSV file
 * @param options validation options
 * @returns a stream of validation issues
 */
export async function* validateCsvwFromUrl(
  url: string,
  options: Csvw2RdfOptions & { originalUrl?: string },
): AsyncIterable<Issue> {
  try {
    yield* eventEmitterToAsyncIterable(
      csvUrlToRdf(url, { ...options, minimal: true }),
      'warning',
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      yield { type: 'error', message: error.message, location: error.location };
    } else {
      throw error;
    }
  }
}
