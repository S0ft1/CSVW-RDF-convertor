import {
  ResolveJsonldFn,
  ResolveCsvStreamFn,
  ResolveWkfFn,
} from './req-resolve.js';

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
  descriptorNotProvided?: boolean;
}
