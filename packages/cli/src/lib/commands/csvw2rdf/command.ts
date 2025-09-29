import { CommandModule } from 'yargs';
import { CommonArgs } from '../../common.js';
import { pairwise } from '../../utils/pairwise.js';
import { commonPrefixes, RDFSerialization } from '@csvw-rdf-convertor/core';
import { ArgsWithDefaults, handler } from './handler.js';
import { dotProps } from '../../utils/dot-props.js';
import { confirm, input, select } from '@inquirer/prompts';
import { getPrefixes } from '../interactive/get-path-overrides.js';
import { baseAtCwd } from '../../utils/base-at-cwd.js';

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
  minimal?: boolean;
  templateIris?: boolean;
  format?: RDFSerialization;
  turtle: TurtleOptions;
  interactive: boolean;
}

export const csvw2rdf: CommandModule<CommonArgs, C2RArgs> = {
  command: 'csvw2rdf',
  aliases: ['c2r'],
  describe: 'Convert CSVW to RDF',
  builder: {
    format: {
      describe: 'Output RDF serialization',
      choices: ['nquads', 'ntriples', 'turtle', 'trig', 'jsonld'],
      defaultDescription:
        'Tries to infer the format from the output file extension, otherwise defaults to turtle',
    },
    output: {
      alias: 'o',
      describe: 'Output file',
      type: 'string',
      defaultDescription: 'Prints to stdout',
    },
    minimal: {
      describe: 'Use minimal conversion mode',
      type: 'boolean',
    },
    templateIris: {
      describe: 'Use template IRIs instead of URIs',
      type: 'boolean',
      default: true,
    },
    interactive: {
      describe: 'Interactive mode',
      type: 'boolean',
      default: false,
    },
    ['turtle.base']: {
      describe: 'Base IRI for turtle/TriG output',
      type: 'string',
    },
    ['turtle.prefix']: {
      array: true,
      type: 'string',
      describe:
        'Prefix for turtle/TriG output. Format: --turtle.prefix pref1: path1 pref2: path2 ...',
      defaultDescription:
        'RDFa Core Initial Context (https://www.w3.org/2011/rdfa-context/rdfa-1.1)',
      coerce: (value: string[]) => {
        if (value.length % 2) {
          throw new Error(
            `Missing value for path override "${value[value.length - 1]}"`,
          );
        }
        return Object.fromEntries(
          pairwise(value).map(([p, v]) => [p.slice(0, -1), v]),
        );
      },
    },
    ['turtle.prefixLookup']: {
      describe: 'Lookup prefixes for turtle/TriG output',
      type: 'boolean',
      defaultDescription: 'false',
      conflicts: ['turtle.streaming'],
    },
    ['turtle.streaming']: {
      describe:
        'When streaming the output, some pretty printing is not possible',
      type: 'boolean',
      defaultDescription: 'true',
      conflicts: ['turtle.prefixLookup'],
    },
  },
  handler: async (args) => {
    dotProps(args);
    args.turtle ??= {};
    if (args.interactive) {
      await interactiveOptions(args);
    } else {
      defaultOptions(args);
    }

    if (args.input) {
      args.input = baseAtCwd(args.input);
      console.log('Using input file', args.input);
    }

    await handler(args as ArgsWithDefaults);
  },
};

/**
 * Infer RDF serialization format from the output file name.
 * @param output Output file name
 */
export function inferFormat(output?: string): RDFSerialization | undefined {
  if (!output) return undefined;
  const ext = output.split('.').pop();
  switch (ext) {
    case 'json':
    case 'jsonld':
      return 'jsonld';
    case 'nq':
      return 'nquads';
    case 'nt':
      return 'ntriples';
    case 'xml':
    case 'rdf':
      return 'rdfxml';
    case 'trig':
      return 'trig';
    case 'ttl':
      return 'turtle';
    default:
      return undefined;
  }
}

async function interactiveOptions(args: C2RArgs): Promise<void> {
  args.output ??= await input({
    message: 'Output file [stdin]',
  });
  args.format ??= inferFormat(args.output);
  if (!args.format) {
    args.format = await select({
      choices: [
        'nquads',
        'ntriples',
        'turtle',
        'trig',
        'jsonld',
      ] satisfies RDFSerialization[],
      message: 'Output format [turtle]',
      default: 'turtle',
    });
  }
  args.baseIri ??=
    (await input({
      message: `Base IRI for loading resources ${args.input ? '' : '[empty]'}`,
      default: '',
    })) || undefined;
  args.minimal ??= await confirm({
    message:
      'Use minimal mode (include only the information gleaned from the cells of the tabular data)',
    default: false,
  });
  args.templateIris ??= await confirm({
    message:
      'Use template IRIs instead of URIs (e.g. https://example.com/{name} could result in https://example.com/Adéla instead of https://example.com/Ad%C3%A9la)',
    default: false,
  });
  if (args.format === 'turtle' || args.format === 'trig') {
    args.turtle.base ??= await input({
      message: 'Base IRI for turtle/TriG output [empty]',
    });
    args.turtle.streaming ??= !(await confirm({
      message:
        'Will the result fit in memory? (If not, some pretty printing is not possible)',
      default: false,
    }));
    if (args.turtle.streaming) {
      args.turtle.prefixLookup = false;
      if (!args.turtle.prefix || Object.keys(args.turtle.prefix).length === 0) {
        const manualPrefixes = await getPrefixes();
        if (manualPrefixes.length > 0) {
          args.turtle.prefix = {
            ...commonPrefixes,
            ...Object.fromEntries(manualPrefixes),
          };
        } else {
          args.turtle.prefix = commonPrefixes;
        }
      }
    } else {
      args.turtle.prefixLookup ??= await confirm({
        message: 'Lookup prefixes for turtle/TriG output',
        default: false,
      });
    }
  }
}
function defaultOptions(args: C2RArgs): void {
  args.format = args.format ?? inferFormat(args.output) ?? 'turtle';
  args.turtle.prefix ??= commonPrefixes;
  if (args.turtle.prefixLookup) {
    if (args.turtle.streaming) {
      throw new Error(
        'Cannot use --turtle.prefixLookup and --turtle.streaming together',
      );
    }
    args.turtle.streaming = false;
  }
  if (args.turtle.streaming) {
    args.turtle.prefixLookup = false;
  }
  args.turtle.prefixLookup ??= false;
  args.turtle.streaming ??= true;
}
