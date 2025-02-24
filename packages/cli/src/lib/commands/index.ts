import { CommandModule } from 'yargs';
import { csvw2rdf } from './csvw2rdf.js';
import { rdf2csvw } from './rdf2csvw.js';
import { validate } from './validate.js';
import { CommonArgs } from '../common.js';

export const commands: CommandModule<CommonArgs, any>[] = [
  validate,
  csvw2rdf,
  rdf2csvw,
];
