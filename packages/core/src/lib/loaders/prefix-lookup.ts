import { commonPrefixes } from '@csvw-rdf-convertor/core';
import PrefixMap from '@rdfjs/prefix-map/PrefixMap.js';
import { Quad } from '@rdfjs/types';
import N3 from 'n3';

const { namedNode } = N3.DataFactory;

export interface PrefixCCResponse {
  [key: string]: string;
}

/**
 * Create a prefix map using the {@link https://prefix.cc} service.
 * @param quads - Array of RDF quads to check for prefixes
 * @param prefixes - Initial prefixes to use
 */
export async function lookupPrefixes(
  quads: Quad[],
  prefixes: Record<string, string>,
): Promise<PrefixMap> {
  const pmap = new PrefixMap(
    Object.entries(prefixes).map(([k, v]) => [k, namedNode(v)]),
    { factory: N3.DataFactory },
  );
  const commonInverse = new Map(
    Object.entries(commonPrefixes).map(([k, v]) => [v, k]),
  );
  const pmapValues = new Set(Object.values(prefixes));
  const lookupFailures = new Set<string>();
  const candidates = getPrefixCandidates(quads);
  for (const candidate of candidates) {
    if (pmapValues.has(candidate)) {
      continue;
    }
    const commonMatch = commonInverse.get(candidate as any);
    if (commonMatch) {
      pmap.set(commonMatch, namedNode(candidate));
      pmapValues.add(candidate);
      continue;
    }

    if (lookupFailures.has(candidate)) {
      continue;
    }

    const serviceMatch = await getPrefixFromService(candidate);
    if (serviceMatch) {
      pmap.set(serviceMatch, namedNode(candidate));
      pmapValues.add(candidate);
    } else {
      lookupFailures.add(candidate);
    }
  }
  return pmap;
}

/**
 * Looks up prefix of the namespace using {@link https://prefix.cc} service.
 * @param uri - URI of the RDF namespace
 * @returns Prefix of the namespace if found, otherwise null
 */
export function getPrefixFromService(uri: string): Promise<string | null> {
  if (!uri || !uri.startsWith('http')) return Promise.resolve(null);
  return (
    fetch(
      `https://prefix.cc/reverse?uri=${encodeURIComponent(uri)}&format=json`,
    )
      .then((response) => response.json() as Promise<PrefixCCResponse>)
      .then((data) => Object.keys(data)[0])
      // No registered prefix for the given URI, or prefix.cc does not respond
      .catch(() => null)
  );
}

/**
 * Get IRIs which could be replaced with prefixes.
 * @param quads - Quads to get prefix candidates from
 */
export function getPrefixCandidates(quads: Quad[]): Set<string> {
  const candidates = new Set<string>();
  for (const quad of quads) {
    for (const nnode of [quad.subject, quad.predicate, quad.object].filter(
      (n) => n.termType === 'NamedNode',
    )) {
      const url = nnode.value;
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        if (hashIndex !== 0) {
          candidates.add(url.slice(0, hashIndex + 1));
        }
      } else {
        const slashIndex = url.lastIndexOf('/');
        if (slashIndex !== 0) {
          candidates.add(url.slice(0, slashIndex + 1));
        }
      }
    }
  }
  return candidates;
}
