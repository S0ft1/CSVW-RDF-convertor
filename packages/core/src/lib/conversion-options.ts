import { ResolveJsonldFn, ResolveCsvStreamFn } from './req-resolve.js';

export interface Csvw2RdfOptions {
  pathOverrides?: [string | RegExp, string][];
  offline?: boolean;
  baseIRI?: string;
  resolveJsonldFn?: ResolveJsonldFn;
  resolveCsvStreamFn?: ResolveCsvStreamFn;
}
