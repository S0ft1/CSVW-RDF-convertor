import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
} from '@csvw-rdf-convertor/core';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

function getUrl(path: string, base: string) {
  if (isAbsolute(base)) {
    // filesystem path
    return resolve(base, path);
  }
  return (
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path)
  );
}

export async function resolveJson(path: string, base: string) {
  const url = getUrl(path, base);
  if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
    if (url.startsWith('file:')) {
      return readFile(fileURLToPath(url), 'utf-8');
    }
    return defaultResolveJsonldFn(url, base);
  }
  return await readFile(url, 'utf-8');
}
export async function resolveText(path: string, base: string) {
  const url = getUrl(path, base);
  if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
    if (url.startsWith('file:')) {
      return readFile(fileURLToPath(url), 'utf-8');
    }
    return defaultResolveTextFn(url, base);
  }
  return await readFile(url, 'utf-8');
}
export function resolveTextStream(path: string, base: string) {
  const url = getUrl(path, base);
  if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
    if (url.startsWith('file:')) {
      return Promise.resolve(
        Readable.toWeb(createReadStream(fileURLToPath(url), 'utf-8')),
      );
    }
    return defaultResolveStreamFn(url, base);
  }
  return Promise.resolve(
    Readable.toWeb(createReadStream(resolve(base, url), 'utf-8')),
  );
}
