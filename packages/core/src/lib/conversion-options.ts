import {
  ResolveJsonldFn,
  ResolveCsvStreamFn,
  ResolveRdfStreamFn,
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
  descriptorNotProvided?: boolean;
  /** Function which loads rdf files. */
  resolveRdfStreamFn?: ResolveRdfStreamFn;
}
