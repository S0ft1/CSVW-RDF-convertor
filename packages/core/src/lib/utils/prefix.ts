import { csvwNs } from '../types/descriptor/namespace.js';

/**
 * RDFa Core Initial Context
 * @see https://www.w3.org/2011/rdfa-context/rdfa-1.1
 */
export const commonPrefixes = {
  as: 'https://www.w3.org/ns/activitystreams#',
  cc: 'http://creativecommons.org/ns#',
  csvw: csvwNs + '#',
  ctag: 'http://commontag.org/ns#',
  dc: 'http://purl.org/dc/terms/',
  dc11: 'http://purl.org/dc/elements/1.1/',
  dcat: 'http://www.w3.org/ns/dcat#',
  dcterms: 'http://purl.org/dc/terms/',
  dqv: 'http://www.w3.org/ns/dqv#',
  duv: 'http://www.w3.org/ns/duv#',
  earl: 'http://www.w3.org/ns/earl#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  gr: 'http://purl.org/goodrelations/v1#',
  grddl: 'http://www.w3.org/2003/g/data-view#',
  ical: 'http://www.w3.org/2002/12/cal/icaltzd#',
  jsonld: 'http://www.w3.org/ns/json-ld#',
  ldp: 'http://www.w3.org/ns/ldp#',
  ma: 'http://www.w3.org/ns/ma-ont#',
  oa: 'http://www.w3.org/ns/oa#',
  odrl: 'http://www.w3.org/ns/odrl/2/',
  og: 'http://ogp.me/ns#',
  org: 'http://www.w3.org/ns/org#',
  owl: 'http://www.w3.org/2002/07/owl#',
  prov: 'http://www.w3.org/ns/prov#',
  qb: 'http://purl.org/linked-data/cube#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfa: 'http://www.w3.org/ns/rdfa#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  rev: 'http://purl.org/stuff/rev#',
  rif: 'http://www.w3.org/2007/rif#',
  rr: 'http://www.w3.org/ns/r2rml#',
  schema: 'http://schema.org/',
  sd: 'http://www.w3.org/ns/sparql-service-description#',
  sioc: 'http://rdfs.org/sioc/ns#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  skosxl: 'http://www.w3.org/2008/05/skos-xl#',
  sosa: 'http://www.w3.org/ns/sosa/',
  ssn: 'http://www.w3.org/ns/ssn/',
  time: 'http://www.w3.org/2006/time#',
  v: 'http://rdf.data-vocabulary.org/#',
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  void: 'http://rdfs.org/ns/void#',
  wdr: 'http://www.w3.org/2007/05/powder#',
  wdrs: 'http://www.w3.org/2007/05/powder-s#',
  xhv: 'http://www.w3.org/1999/xhtml/vocab#',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
} as const;

export const XSD_TEMP_PREFIX = 'XXX' as const;
export const XSD_TEMP = `${XSD_TEMP_PREFIX}${commonPrefixes.xsd}` as const;

/**
 * Looks up URI of the RDF namespace using {@link https://prefix.cc} service.
 * @param prefix - Prefix of the namespace
 * @returns URI of the namespace if found, otherwise null
 */
export function getUri(prefix: string): Promise<string | null> {
  return (
    fetch(`https://prefix.cc/${prefix}.file.json`)
      .then((response) => response.json() as Promise<PrefixCCResponse>)
      .then((data) => data[prefix])
      // Prefix not found, or prefix.cc does not respond
      .catch(() => null)
  );
}

/**
 * Looks up prefix of the namespace using {@link https://prefix.cc} service.
 * @param uri - URI of the RDF namespace
 * @returns Prefix of the namespace if found, otherwise null
 */
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

const { xsd } = commonPrefixes;

export const numericTypes = new Set([
  xsd + 'integer',
  xsd + 'decimal',
  xsd + 'long',
  xsd + 'int',
  xsd + 'short',
  xsd + 'byte',
  xsd + 'nonNegativeInteger',
  xsd + 'positiveInteger',
  xsd + 'unsignedLong',
  xsd + 'unsignedInt',
  xsd + 'unsignedShort',
  xsd + 'unsignedByte',
  xsd + 'double',
  xsd + 'float',
  xsd + 'nonPositiveInteger',
  xsd + 'negativeInteger',
]);
export const dateTypes = new Set([
  xsd + 'date',
  xsd + 'dateTime',
  xsd + 'time',
  xsd + 'dateTimeStamp',
]);
