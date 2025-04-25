// import { MemoryLevel } from 'memory-level';
// import { Csvw2RdfOptions } from './conversion-options.js';
// import { Quadstore } from 'quadstore';
// import { DataFactory } from 'n3';
// import { DescriptorWrapper, normalizeDescriptor } from './core.js';
// import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
// import { Csvw2RdfConvertor } from './csvw2rdf-convertor.js';

// let _descriptor: DescriptorWrapper;

// async function convertCSV2RDF(
//   options: Csvw2RdfOptions,
//   descriptor: string | AnyCsvwDescriptor
// ) {
//   const actualBackend = new MemoryLevel() as any;
//   _descriptor = await normalizeDescriptor(descriptor, options);
//   const convertor: Csvw2RdfConvertor = new Csvw2RdfConvertor(options);
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
