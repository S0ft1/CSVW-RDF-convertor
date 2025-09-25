import { csvwNs } from './types/descriptor/namespace.js';
import { csvwContext } from './types/descriptor/csvw.json.js';

export interface FetchCacheInterface {
  inCache(url: string, baseIri: string): boolean;
  fromCache(url: string, baseIri: string): Promise<string | undefined>;
  toCache(
    url: string,
    baseIri: string,
    content: Promise<string>,
    cacheErrors?: boolean,
  ): Promise<void>;
}

export class DefaultFetchCache {
  private cache: Map<string, { result?: string; error?: any }> = new Map();

  constructor() {
    this.cache.set(csvwNs, { result: JSON.stringify(csvwContext) });
  }

  public inCache(url: string, baseIri: string): boolean {
    return this.cache.has(this.combine(url, baseIri));
  }
  public fromCache(url: string, baseIri: string): Promise<string | undefined> {
    const entry = this.cache.get(this.combine(url, baseIri));
    if (!entry) return Promise.resolve(undefined);
    if ('error' in entry) {
      return Promise.reject(entry.error);
    } else {
      return Promise.resolve(entry.result);
    }
  }
  public async toCache(
    url: string,
    baseIri: string,
    content: Promise<string>,
    cacheErrors = false,
  ): Promise<void> {
    const key = this.combine(url, baseIri);
    try {
      const result = await content;
      this.cache.set(key, { result });
    } catch (error) {
      if (cacheErrors) {
        this.cache.set(key, { error });
      }
    }
  }

  protected combine(url: string, base: string) {
    return (
      URL.parse(url, base)?.href ?? URL.parse(url)?.href ?? base + '/' + url
    );
  }
}
