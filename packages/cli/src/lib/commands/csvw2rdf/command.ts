import { CommandModule } from 'yargs';
import { CommonArgs } from '../../common.js';
import { RDFSerialization } from '../../rdf-serialization.js';
import { pairwise } from 'src/lib/utils/pairwise.js';
import { commonPrefixes } from '@csvw-rdf-convertor/core';

export type TurtleOptions = {
  base?: string;
  prefix?: Record<string, string>;
} & (
  | {
      prefixLookup?: true;
      streaming?: false;
    }
  | {
      prefixLookup?: false;
      streaming?: true;
    }
);

export interface C2RArgs extends CommonArgs {
  output?: string;
  offline?: boolean;
  minimal?: boolean;
  templateIris?: boolean;
  baseIri?: string;
  format?: RDFSerialization;
  turtle?: TurtleOptions;
}

export const csvw2rdf: CommandModule<CommonArgs, C2RArgs> = {
  command: 'csvw2rdf',
  aliases: ['c2r'],
  describe: 'Convert CSVW to RDF',
  builder: {
    format: {
      describe: 'Output RDF serialization',
      choices: ['nquads', 'ntriples', 'turtle', 'trig'],
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
      describe: 'Do not fetch remote context files (does not work yet)',
      type: 'boolean',
    },
    minimal: {
      describe: 'Use minimal output',
      type: 'boolean',
    },
    templateIris: {
      describe: 'Use template IRIs instead of URIs',
      type: 'boolean',
    },
    baseIri: {
      describe: 'Base IRI for loading resources',
      type: 'string',
    },
    ['turtle.base']: {
      describe: 'Base IRI for turtle/TriG output',
      type: 'string',
    },
    ['turtle.prefix']: {
      array: true,
      type: 'string',
      describe:
        'Prefix for turtle/TriG output. Format: --turtle.prefix :pref1 path1 :pref2 path2 ...',
      defaultDescription:
        'RDFa Core Initial Context (https://www.w3.org/2011/rdfa-context/rdfa-1.1)',
      coerce: (value: string[]) => {
        if (value.length % 2) {
          throw new Error(
            `Missing value for path override "${value[value.length - 1]}"`
          );
        }
        return Object.fromEntries(pairwise(value));
      },
    },
    ['turtle.prefixLookup']: {
      describe: 'Use prefix lookup for turtle/TriG output',
      type: 'boolean',
      default: false,
      conflicts: ['turtle.streaming'],
    },
    ['turtle.streaming']: {
      describe:
        'When streaming the output, some pretty printing is not possible',
      type: 'boolean',
      default: true,
      conflicts: ['turtle.prefixLookup'],
    },
  },
  handler: async (args) => {
    args.format = args.format ?? inferFormat(args.output);
    args.baseIri ??= args.input;
    args.turtle ??= {};
    args.turtle.prefix ??= commonPrefixes;
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
    case 'trig':
      return 'trig';
    case 'ttl':
    default:
      return 'turtle';
  }
}
