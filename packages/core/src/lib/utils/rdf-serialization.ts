export const n3Formats: Record<RDFSerialization, string> = {
  jsonld: 'text/turtle',
  nquads: 'application/n-quads',
  ntriples: 'application/n-triples',
  rdfxml: 'text/turtle',
  trig: 'application/trig',
  turtle: 'text/turtle',
};

export type RDFSerialization =
  | 'jsonld'
  | 'nquads'
  | 'ntriples'
  | 'rdfxml'
  | 'turtle'
  | 'trig';
