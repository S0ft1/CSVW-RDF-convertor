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
