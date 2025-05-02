import {
  ResolveJsonldFn,
  ResolveCsvStreamFn,
  ResolveWkfFn,
} from './req-resolve.js';

export interface ConversionOptions {
  pathOverrides?: [string | RegExp, string][];
  baseIRI?: string;
  /** Function which loads json-ld. The default implementation also interprets Link headers. */
  resolveJsonldFn?: ResolveJsonldFn;
}

export interface Csvw2RdfOptions extends ConversionOptions {
  offline?: boolean;
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
