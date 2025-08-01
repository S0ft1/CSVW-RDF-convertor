import { Argv } from 'yargs';
import { pairwise } from './utils/pairwise.js';
import { makeRe } from 'minimatch';

export interface CommonArgs {
  input?: string;
  logLevel?: string;
  pathOverrides?: [string | RegExp, string][];
  baseIri?: string;
}
export function registerCommonArgs(yargs: Argv): Argv<CommonArgs> {
  return yargs
    .option('input', {
      alias: 'i',
      describe: 'Input file or URL.',
      type: 'string',
      defaultDescription: 'Reads from stdin',
    })
    .option('logLevel', {
      describe: 'Set level of information shown during logging.',
      type: 'string',
      choices: ['error', 'warn', 'debug'],
      default: 'warn',
      hidden: true,
      coerce: (val: string) => {
        if (val === 'debug') {
          process.env.DEV_MODE = 'true';
        }
        return val;
      },
    })
    .option('pathOverrides', {
      array: true,
      describe:
        'Path overrides. Format: --pathOverrides path1 value1 path2 value2 ...',
      type: 'string',
      coerce: (value: string[]) => {
        if (value.length % 2) {
          throw new Error(
            `Missing value for path override "${value[value.length - 1]}"`
          );
        }
        return pairwise(value).map(
          ([p, v]) => [makeRe(p) || p, v] as [string | RegExp, string]
        );
      },
    })
    .option('baseIri', {
      describe: 'Base IRI for loading resources',
      type: 'string',
    });
}
