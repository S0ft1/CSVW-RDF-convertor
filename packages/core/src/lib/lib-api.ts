// import { MemoryLevel } from 'memory-level';
// import { Csvw2RdfOptions } from './conversion-options.js';
// import { Quadstore } from 'quadstore';
// import { DataFactory } from 'n3';
// import { DescriptorWrapper, normalizeDescriptor } from './core.js';
// import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
// import { CSVW2RDFConvertor } from './csvw2rdf-convertor.js';

// let _descriptor: DescriptorWrapper;

// async function convertCSV2RDF(
//   options: Csvw2RdfOptions,
//   descriptor: string | AnyCsvwDescriptor
// ) {
//   const actualBackend = new MemoryLevel() as any;
//   _descriptor = await normalizeDescriptor(descriptor, options);
//   const convertor: CSVW2RDFConvertor = new CSVW2RDFConvertor(options);
//   convertor.convert(_descriptor);
// }

// /*
// function convertRDF2CSV(options : Csvw2RdfOptions){

// }

// function getSchema(schemaName : string){

// }*/

// function getDescriptor(): DescriptorWrapper | null {
//   if (_descriptor != null) {
//     return _descriptor;
//   }
//   return null;
// }
