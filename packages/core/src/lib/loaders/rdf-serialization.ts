export const n3Formats: Record<RDFSerialization, string> = {
  jsonld: 'text/turtle',
  nquads: 'application/n-quads',
  ntriples: 'application/n-triples',
  rdfxml: 'text/turtle',
  trig: 'application/trig',
  turtle: 'text/turtle',
};

export const mimeTypes: Record<RDFSerialization, string> = {
  jsonld: 'application/ld+json',
  nquads: 'application/n-quads',
  ntriples: 'application/n-triples',
  rdfxml: 'application/rdf+xml',
  trig: 'application/trig',
  turtle: 'application/turtle',
};

export const fileExtensions: Record<RDFSerialization, string> = {
  jsonld: 'json',
  nquads: 'nq',
  ntriples: 'nt',
  rdfxml: 'rdf',
  trig: 'trig',
  turtle: 'ttl',
};

export const serializationLabels: Record<RDFSerialization, string> = {
  jsonld: 'JSON-LD',
  nquads: 'N-Quads',
  ntriples: 'N-Triples',
  rdfxml: 'RDF/XML',
  trig: 'TriG',
  turtle: 'Turtle',
}

export type RDFSerialization =
  | 'jsonld'
  | 'nquads'
  | 'ntriples'
  | 'rdfxml'
  | 'turtle'
  | 'trig';
