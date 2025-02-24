import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';

/**
 * relative to cwd
 */
export async function readFileOrUrl(path: string): Promise<string> {
  // C:/foo can be parsed as a valid URL
  if (!isAbsolute(path) && URL.canParse(path)) {
    if (path.startsWith('file:')) {
      return readFile(fileURLToPath(path), 'utf-8');
    }
    const response = await fetch(path);
    return response.text();
  }
  const text = await readFile(path, 'utf-8');
  return text;
}
