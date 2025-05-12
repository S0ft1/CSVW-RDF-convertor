
import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import { CsvwTableGroupDescription } from '../types/descriptor/table-group.js';
import { validateDialect } from './dialect.js';
import {
  PropertySchema,
  validateAllowedKeys,
  validateArray,
  validateChild,
  validateType,
  validateObject,
} from './generic.js';
import {
  inhPropKeys,
  validateInheritedProperties,
} from './inherited-properties.js';
import { validateTable } from './table.js';
import { validateTemplate } from './template.js';

const tgSchema: Partial<
  Record<keyof CsvwTableGroupDescription, PropertySchema>
> = {
  tableDirection: {
    type: 'string',
    validate: (v) => v === 'ltr' || v === 'rtl' || v === 'auto',
  },
};
const tgKeys = [
  ...inhPropKeys,
  'tables',
  'dialect',
  'notes',
  'tableDirection',
  'tableSchema',
  'transformations',
  '@id',
  '@type',
  '@context',
];
/**
 * Validates a `CsvwTableGroupDescription` object against the defined schema and rules.
 * 
 * This function performs a series of checks to ensure that the provided table group
 * adheres to the CSVW (CSV on the Web) specifications. It validates the allowed keys,
 * object structure, inherited properties, and child elements such as `dialect`, `tables`,
 * and `transformations`. Additionally, it ensures that the table group contains at least
 * one table and has the correct type.
 * 
 * @param {CsvwTableGroupDescription} tg - The table group description object to validate.
 * @param {Csvw2RdfContext} ctx - The context object containing validation utilities and an issue tracker.
 * 
 * @throws Will add errors to the issue tracker in the context if validation fails.
 */
export function validateTableGroup(
  tg: CsvwTableGroupDescription,
  ctx: Csvw2RdfContext
): void {
  validateAllowedKeys(tg, tgKeys, 'Table group', ctx);
  validateObject(tg, tgSchema, 'Table group', ctx);
  validateInheritedProperties(tg, 'Table group', ctx);
  validateChild(tg, 'dialect', validateDialect, ctx);
  if (!tg.tables?.length) {
    ctx.issueTracker.addError('Table group must contain at least one table');
  }
  validateType(tg, 'TableGroup', ctx);
  validateArray(tg, 'transformations', validateTemplate, ctx);
  validateArray(tg, 'tables', validateTable, ctx);
}
