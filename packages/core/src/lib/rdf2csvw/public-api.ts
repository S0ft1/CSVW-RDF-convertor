import { Quad, Stream } from '@rdfjs/types';
import { Rdf2CsvOptions } from '../conversion-options.js';
import { TableGroupSchema } from './schema/table-group-schema.js';
import { CsvwTableStreams } from './convertor.js';

export async function rdfToCsvw(
  rdf: Stream<Quad>,
  options?: Rdf2CsvOptions,
): Promise<CsvwTableStreams> {
  options ??= {};
  if (!options?.descriptor) {
    options.descriptor = await rdfToTableSchema(rdf, options);
  }
  return null as any;
}

export function loadRdf(url: string, options?: Rdf2CsvOptions): Stream<Quad> {
  return null as any;
}

export function rdfToTableSchema(
  rdf: Stream<Quad>,
  options?: Rdf2CsvOptions,
): Promise<TableGroupSchema> {
  return null as any;
}
