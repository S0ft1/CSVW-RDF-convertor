import { CommandModule } from 'yargs';
import { CommonArgs } from '../common.js';
import { CSVW2RDFConvertor, RDFSerialization } from '@cssw-rdf-convertor/core';

export const csvw2rdf: CommandModule<
  CommonArgs,
  CommonArgs & {
    format?: RDFSerialization;
    output?: string;
    offline?: boolean;
  }
> = {
  command: 'csvw2rdf',
  aliases: ['c2r'],
  describe: 'Convert CSVW to RDF',
  builder: {
    format: {
      describe: 'Output RDF serialization',
      choices: ['jsonld', 'nquads', 'ntriples', 'rdfxml', 'turtle'],
      defaultDescription:
        'Tries to infer the format from the output file extension, otherwise defaults to turtle',
    },
    output: {
      alias: 'o',
      describe: 'Output file',
      type: 'string',
      defaultDescription: 'Prints to stdout',
    },
    offline: {
      describe: 'Do not fetch remote context files',
      type: 'boolean',
    },
  },
  handler: async (args) => {
    args.format = args.format ?? inferFormat(args.output);
    console.log('csvw2rdf', args);
    const convertor = new CSVW2RDFConvertor(args.config, args.pathOverrides, args.offline);
    await convertor.convert(args.input, args.output, args.format);
  },
};

function inferFormat(output?: string): RDFSerialization {
  if (!output) return 'turtle';
  const ext = output.split('.').pop();
  switch (ext) {
    case 'json':
      return 'jsonld';
    case 'nq':
      return 'nquads';
    case 'nt':
      return 'ntriples';
    case 'xml':
      return 'rdfxml';
    case 'ttl':
    default:
      return 'turtle';
  }
}
