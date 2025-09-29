import { isAbsolute, resolve } from 'node:path';

/**
 * If the given path is relative, make it absolute relative to the current working directory.
 */
export function baseAtCwd(path: string): string {
  return isAbsolute(path) || URL.canParse(path)
    ? path
    : resolve(process.cwd(), path);
}
