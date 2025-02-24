import { Argv } from 'yargs';
import { pairwise } from './utils/pairwise.js';

export interface CommonArgs {
  config?: unknown;
  input?: string;
  pathOverrides?: Record<string, string>;
}
export function registerCommonArgs(yargs: Argv): Argv<CommonArgs> {
  return yargs
    .option('config', {
      describe:
        'Configuration file in JSON-LD format. May be also provided as a part of the CSVW descriptor. ' +
        'Properties specified in the configuration file will override the corresponding properties in the CSVW descriptor.',
      config: true,
      type: 'string',
    })
    .option('input', {
      alias: 'i',
      describe: 'Input file or URL.',
      type: 'string',
      defaultDescription: 'Reads from stdin',
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
        return Object.fromEntries(pairwise(value));
      },
    });
}
