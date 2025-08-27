import { Quad, Stream } from '@rdfjs/types';
import { Rdf2CsvOptions } from '../conversion-options.js';
import { TableGroupSchema } from './schema/table-group-schema.js';
import { Rdf2CsvwConvertor } from './convertor.js';
import { Readable } from 'readable-stream';

/**
 * Converts RDF data to CSVW format, including both table streams and descriptor.
 * This is the main entry point for RDF to CSVW conversion operations.
 * @param rdf - A stream of RDF quads to be converted to CSVW format.
 * @param options - Optional conversion options including descriptor and other settings.
 * @returns Promise resolving to a tuple containing CSVW table streams and the descriptor wrapper.
 */
export async function rdfToCsvw(
  rdf: Stream<Quad>,
  options?: Rdf2CsvOptions,
): Promise<Readable> {
  options ??= {};
  const convertor = new Rdf2CsvwConvertor(options);
  return convertor.convert(rdf);
}

/**
 * Generates a CSVW table schema from RDF data by analyzing the structure and properties.
 * This function infers the appropriate table schema based on the RDF triples provided.
 * @param rdf - A stream of RDF quads to analyze for schema inference.
 * @param options - Optional conversion options that may affect schema generation.
 * @returns Promise resolving to a TableGroupSchema that describes the inferred CSVW structure.
 */
export function rdfToTableSchema(
  rdf: Stream<Quad>,
  options?: Rdf2CsvOptions,
): Promise<TableGroupSchema> {
  const convertor = new Rdf2CsvwConvertor(options);
  return convertor.inferSchema(rdf);
}
