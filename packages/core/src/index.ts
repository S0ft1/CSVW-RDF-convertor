import { normalizeDescriptor } from './lib/core.js';
import { CSVW2RDFConvertor } from './lib/csvw2rdf-convertor.js';
import { readFileSync } from 'node:fs';
import N3 from 'n3';
import { commonPrefixes } from './lib/utils/prefix.js';

const jsonLDTEST = readFileSync(
  import.meta.dirname + '/../../../organizační-struktura.csv-metadata.json',
  'utf-8'
);

const convertor: CSVW2RDFConvertor = new CSVW2RDFConvertor();
const descriptor = await normalizeDescriptor(jsonLDTEST);
const stream = await convertor.convert(descriptor);
const writer = new N3.StreamWriter({
  prefixes: commonPrefixes,
});
writer.import(stream);
writer.pipe(process.stdout);
