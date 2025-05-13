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
