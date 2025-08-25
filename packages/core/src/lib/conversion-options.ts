import { TableGroupSchema } from './rdf2csvw/schema/table-group-schema.js';
import {
  ResolveJsonldFn,
  ResolveCsvStreamFn,
  ResolveWkfFn,
  ResolveRdfFn,
} from './req-resolve.js';
import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';

export interface ConversionOptions {
  /**
   * Replacements for matching paths. [pattern, value] pairs.
   * If the pattern is a string, all paths starting with the string will be replaced.
   */
  pathOverrides?: [string | RegExp, string][];

  /** for loading resources */
  baseIri?: string;

  /** Function which loads json-ld. The default implementation also interprets Link headers. */
  resolveJsonldFn?: ResolveJsonldFn;

  /** Level of information shown to the user during logging. */
  logLevel?: LogLevel;
}

/** Levels of information shown to the user during logging. */
export enum LogLevel {
  Error = 0,
  Warn = 1,
  Debug = 2,
}

export interface Csvw2RdfOptions extends ConversionOptions {
  /** If true (default is false), template URIs will be parsed into IRIs */
  templateIris?: boolean;
  minimal?: boolean;
  /** Function which loads csv files. */
  resolveCsvStreamFn?: ResolveCsvStreamFn;
  /** Function which loads /.well-known/csvm file. */
  resolveWkfFn?: ResolveWkfFn;
}

export interface Rdf2CsvOptions extends ConversionOptions {
  /** Descriptor for the conversion. May be either parsed or unparsed JSON-LD, or a Table Group Schema. */
  descriptor?: string | AnyCsvwDescriptor | TableGroupSchema;
  /** If true (default is false), vocabularies may be fetched and used to enrich the conversion, for example
   * by using rdf:label of properties to name the resulting table columns.
   */
  useVocabMetadata?: boolean;
  /** When processing streams, this controls the number of quads to process at once. */
  windowSize?: number;
  /** Used for loading remote RDF data when {@link useVocabMetadata} is true. */
  resolveRdfFn?: ResolveRdfFn;
}
