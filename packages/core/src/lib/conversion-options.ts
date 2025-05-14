import {
  ResolveJsonldFn,
  ResolveCsvStreamFn,
  ResolveWkfFn,
} from './req-resolve.js';

export interface ConversionOptions {
  pathOverrides?: [string | RegExp, string][];
  /** for loading resources */
  baseIRI?: string;
  /** Function which loads json-ld. The default implementation also interprets Link headers. */
  resolveJsonldFn?: ResolveJsonldFn;
}

export interface Csvw2RdfOptions extends ConversionOptions {
  /** If true (default is false), template URIs will be parsed into IRIs */
  templateIRIs?: boolean;
  minimal?: boolean;
  /** Function which loads csv files. */
  resolveCsvStreamFn?: ResolveCsvStreamFn;
  /** Function which loads /.well-known/csvm file. */
  resolveWkfFn?: ResolveWkfFn;
}

export interface Rdf2CsvOptions extends ConversionOptions {
  descriptorNotProvided?: boolean;
}
