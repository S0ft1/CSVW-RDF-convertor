import { ResolveFn, ResolveStreamFn } from './req-resolve.js';

export interface Csvw2RdfOptions {
  pathOverrides?: [string | RegExp, string][];
  offline?: boolean;
  resolveFn?: ResolveFn;
  resolveStreamFn?: ResolveStreamFn;
}
