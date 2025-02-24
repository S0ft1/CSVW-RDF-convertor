import { CommandModule } from 'yargs';
import { CommonArgs } from '../common.js';

export const validate: CommandModule<CommonArgs, CommonArgs> = {
  command: 'validate',
  describe: 'Validate RDF or CSVW data',
  handler: async (args) => {
    console.log('validate', args);
  },
};
