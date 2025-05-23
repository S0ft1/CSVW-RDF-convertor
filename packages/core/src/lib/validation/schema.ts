import { ValidationContext } from './context.js';
import { CsvwSchemaDescription } from '../types/descriptor/schema-description.js';
import { coerceArray } from '../utils/coerce.js';
import { validateColumn } from './column.js';
import { validateForeignKey } from './foreign-key.js';
import { validateAllowedKeys, validateArray, validateType } from './generic.js';
import { inhPropKeys } from './inherited-properties.js';

const schemaKeys = [
  ...inhPropKeys,
  'columns',
  'foreignKeys',
  'notes',
  'primaryKey',
  'rowTitles',
  '@id',
  '@type',
];

/**
 * Validates a CSVW schema description object against the defined rules and context.
 *
 * @param schema - The schema description object to validate. This object should conform
 *                 to the `CsvwSchemaDescription` interface.
 * @param ctx - The context object of type `Csvw2RdfContext` that provides utilities
 *              and tracking for validation issues.
 */
export function validateSchema(
  schema: CsvwSchemaDescription,
  ctx: ValidationContext
) {
  validateType(schema, 'Schema', ctx);
  validateAllowedKeys(schema, schemaKeys, 'Schema', ctx);
  validateArray(
    schema,
    'foreignKeys',
    (fk) => validateForeignKey(fk, schema, ctx),
    ctx
  );

  if (schema.primaryKey) {
    const cols = coerceArray(schema.primaryKey);
    for (const col of cols) {
      if (!schema.columns?.some((c) => c.name === col)) {
        ctx.issueTracker.addWarning(
          `Invalid primary key: column ${col} not found in schema`
        );
      }
    }
  }
  let i = 0;
  validateArray(schema, 'columns', (c) => validateColumn(c, i++, ctx), ctx);
}
