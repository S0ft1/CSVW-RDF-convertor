import {
  ResolveJsonldFn,
  ResolveCsvStreamFn,
  ResolveWkfFn,
} from './req-resolve.js';

export interface Csvw2RdfOptions {
  pathOverrides?: [string | RegExp, string][];
  offline?: boolean;
  baseIRI?: string;
  templateIRIs?: boolean;
  minimal?: boolean;
  /** Function which loads json-ld. The default implementation also interprets Link headers. */
  resolveJsonldFn?: ResolveJsonldFn;
  /** Function which loads csv files. */
  resolveCsvStreamFn?: ResolveCsvStreamFn;
  /** Function which loads /.well-known/csvm file. */
  resolveWkfFn?: ResolveWkfFn;
}

export interface Rdf2CsvOptions {
  descriptorNotProvided?: boolean;
}