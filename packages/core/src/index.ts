import { normalizeDescriptor } from './lib/core.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { DataFactory } from 'n3';
import { CSVW2RDFConvertor } from './lib/csvw2rdf-convertor.js';
import { readFileSync } from 'node:fs';

const jsonLDTEST = readFileSync(
  import.meta.dirname + '/../../../organizační-struktura.csv-metadata.json',
  'utf-8'
);

const backend = new MemoryLevel() as any;
// different versions of RDF.js types in quadstore and n3
const store = new Quadstore({
  backend,
  dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
});
await store.open();
const convertor: CSVW2RDFConvertor = new CSVW2RDFConvertor();
const descriptor = await normalizeDescriptor(jsonLDTEST, store);
await convertor.convert(descriptor);
