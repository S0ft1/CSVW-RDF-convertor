import { toAbsolute } from './req-resolve.js';
import { csvwNs } from './types/descriptor/namespace.js';
import { csvwContext } from './types/descriptor/csvw.json.js';

export interface FetchCacheInterface {
  inCache(url: string, baseIri: string): boolean;
  fromCache(url: string, baseIri: string): Promise<string>;
  toCache(
    url: string,
    baseIri: string,
    content: Promise<string>,
  ): Promise<void>;
}

export class DefaultFetchCache {
  private cache: Map<string, string> = new Map();

  constructor() {
    this.cache.set(csvwNs, JSON.stringify(csvwContext));
  }

  public inCache(url: string, baseIri: string): boolean {
    return this.cache.has(toAbsolute(url, baseIri));
  }
  public fromCache(url: string, baseIri: string): Promise<string> {
    return Promise.resolve(this.cache.get(toAbsolute(url, baseIri)) || '');
  }
  public async toCache(
    url: string,
    baseIri: string,
    content: Promise<string>,
  ): Promise<void> {
    this.cache.set(toAbsolute(url, baseIri), await content);
  }
}
