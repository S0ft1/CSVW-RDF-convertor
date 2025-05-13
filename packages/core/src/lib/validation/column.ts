import { ValidationContext } from './context.js';
import { CsvwColumnDescription } from '../types/descriptor/column-description.js';
import {
  langMapArraySchema,
  PropertySchema,
  validateAllowedKeys,
  validateType,
  validateObject,
} from './generic.js';
import {
  inhPropKeys,
  validateInheritedProperties,
} from './inherited-properties.js';

const columnSchema: Partial<
  Record<keyof CsvwColumnDescription, PropertySchema>
> = {
  titles: langMapArraySchema,
  name: { type: 'string' },
  virtual: { type: 'boolean' },
  suppressOutput: { type: 'boolean' },
};

const columnKeys = [
  ...inhPropKeys,
  'name',
  'notes',
  'suppressOutput',
  'titles',
  'virtual',
  '@id',
  '@type',
];

const uriVarRegex = /^([a-z0-9]|(%[0-9a-f]{2}))([a-z0-9_.]|(%[0-9a-f]{2}))*$/i;

/**
 * Validates a CSVW column description object against the defined schema and rules.
 *
 * @param c - The column description object to validate. This should conform to the `CsvwColumnDescription` interface.
 * @param index - The index of the column in the table, used for tracking validation context.
 * @param ctx - The context object for the CSVW-to-RDF conversion process, which includes an issue tracker for reporting validation issues.
 *
 * Any validation issues are reported using the `ctx.issueTracker`.
 */
export function validateColumn(
  c: CsvwColumnDescription,
  index: number,
  ctx: ValidationContext
) {
  ctx.issueTracker.location.update({ column: index });
  validateObject(c, columnSchema, 'Column', ctx);
  validateInheritedProperties(c, 'Column', ctx);
  validateAllowedKeys(c, columnKeys, 'Column', ctx);
  validateType(c, 'Column', ctx);
  if (c.name && !c.name.match(uriVarRegex)) {
    ctx.issueTracker.addWarning(`Column name "${c.name}" is invalid`);
    delete c.name;
  }
}
