import { csvwNs } from '../types/descriptor/namespace.js';

export const commonPrefixes = {
  csvw: csvwNs + '#',
  dc: 'http://purl.org/dc/terms/',
  dcat: 'http://www.w3.org/ns/dcat#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  schema: 'http://schema.org/',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
} as const;

export function getUri(prefix: string): Promise<string | null> {
  return (
    fetch(`https://prefix.cc/${prefix}.file.json`)
      .then((response) => response.json() as Promise<PrefixCCResponse>)
      .then((data) => data[prefix])
      // Prefix not found, or prefix.cc does not respond
      .catch(() => null)
  );
}

export function getPrefix(uri: string): Promise<string | null> {
  return (
    fetch(`https://prefix.cc/reverse?uri=${uri}&format=json`)
      .then((response) => response.json() as Promise<PrefixCCResponse>)
      .then((data) => Object.keys(data)[0])
      // No registered prefix for the given URI, or prefix.cc does not respond
      .catch(() => null)
  );
}

export interface PrefixCCResponse {
  [key: string]: string;
}
