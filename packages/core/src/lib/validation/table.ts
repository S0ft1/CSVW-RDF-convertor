import { ValidationContext } from './context.js';
import { CsvwTableDescription } from '../types/descriptor/table.js';
import { validateDialect } from './dialect.js';
import {
  validateType,
  validateArray,
  PropertySchema,
  validateObject,
  validateAllowedKeys,
  validateChild,
} from './generic.js';
import {
  inhPropKeys,
  validateInheritedProperties,
} from './inherited-properties.js';
import { validateSchema } from './schema.js';
import { validateTemplate } from './template.js';

const tableSchema: Partial<Record<keyof CsvwTableDescription, PropertySchema>> =
  {
    tableDirection: {
      type: 'string',
      validate: (v) => v === 'ltr' || v === 'rtl' || v === 'auto',
    },
  };

const tableKeys = [
  ...inhPropKeys,
  'url',
  'dialect',
  'notes',
  'suppressOutput',
  'tableDirection',
  'tableSchema',
  'transformations',
  '@id',
  '@type',
  '@context',
];

/**
 * Validates a CSVW Table Description object against the defined schema and rules.
 *
 * @param t - The `CsvwTableDescription` object representing the table to validate.
 * @param ctx - The `ValidationContext` providing the context for validation, including
 *              the issue tracker and input descriptor.
 *
 * If any validation fails, errors are added to the issue tracker in the provided context.
 */
export function validateTable(t: CsvwTableDescription, ctx: ValidationContext) {
  if (typeof t.url !== 'string') t.url = undefined as any;
  if (t.url === undefined) {
    ctx.issueTracker.addError('Table must have a url property.');
  }
  const base =
    (Array.isArray(ctx.input.descriptor['@context']) &&
      ctx.input.descriptor['@context'][1]?.['@base']) ||
    '';
  t.url = base + t.url;
  ctx.issueTracker.location.update({ table: t.url });
  validateObject(t, tableSchema, `Table (${t.url})`, ctx);
  validateInheritedProperties(t, `Table (${t.url})`, ctx);
  validateAllowedKeys(t, tableKeys, `Table (${t.url})`, ctx);
  validateChild(t, 'dialect', validateDialect, ctx);
  validateType(t, 'Table', ctx);
  validateChild(t, 'tableSchema', validateSchema, ctx);
  validateArray(t, 'transformations', validateTemplate, ctx);
}
