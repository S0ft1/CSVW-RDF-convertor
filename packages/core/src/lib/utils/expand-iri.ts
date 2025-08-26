import { commonPrefixes } from './prefix.js';

/**
 * Expands an IRI based on the common prefixes.
 * @param iri - IRI to be expanded
 * @returns Expanded IRI
 */
export function expandIri(iri: string): string {
  const i = iri.indexOf(':');
  if (i === -1) return iri;
  const prefix = iri.slice(0, i);
  if (prefix in commonPrefixes) {
    return (
      commonPrefixes[prefix as keyof typeof commonPrefixes] + iri.slice(i + 1)
    );
  }
  return iri;
}
