import { CommandModule } from 'yargs';

export const validate: CommandModule = {
  command: 'validate',
  describe: 'Validate RDF or CSVW data',
  builder: {
    input: {
      alias: 'i',
      describe: 'Input file',
      type: 'string',
    },
    config: {
      describe: 'Configuration file',
      config: true,
    },
    pathOverrides: {
      array: true,
      describe: 'Path overrides',
      type: 'string',
    },
  },
  handler: () => {
    console.log('validate');
  },
};
