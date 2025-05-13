import { ValidationContext } from './context.js';
import {
  CsvwForeignKeyDefinition,
  CsvwSchemaDescription,
} from '../types/descriptor/schema-description.js';
import { CsvwTableDescription } from '../types/descriptor/table.js';
import { coerceArray } from '../utils/coerce.js';
import { validateAllowedKeys } from './generic.js';

const fkDefKeys = ['columnReference', 'reference'];
const fkRefKeys = ['resource', 'schemaReference', 'columnReference'];

/**
 * Validates a foreign key definition against a given schema and context.
 *
 * This function ensures that the foreign key definition adheres to the expected structure
 * and references valid columns and tables within the provided schema and input context.
 * Any validation errors are reported to the provided issue tracker.
 *
 * @param fk - The foreign key definition to validate.
 * @param schema - The schema description containing the columns and tables to validate against.
 * @param context - The context containing the input data and issue tracker for reporting errors.
 *   - `input`: Provides access to the tables and other input data.
 *   - `issueTracker`: Used to log validation errors.
 *
 * @throws This function does not throw exceptions but logs errors to the issue tracker.
 *
 */
export function validateForeignKey(
  fk: CsvwForeignKeyDefinition,
  schema: CsvwSchemaDescription,
  { input, issueTracker }: ValidationContext
) {
  validateAllowedKeys(fk, fkDefKeys, 'ForeignKeyDefinition', {
    input,
    issueTracker,
  });
  validateAllowedKeys(fk.reference, fkRefKeys, 'ForeignKeyReference', {
    input,
    issueTracker,
  });
  const colRef = coerceArray(fk.columnReference);
  for (const col of colRef) {
    if (!schema.columns?.some((c) => c.name === col)) {
      issueTracker.addError(`Column ${col} not found in schema`);
    }
  }

  let table: CsvwTableDescription | undefined;
  const tables = Array.from(input.getTables());
  if (fk.reference.resource) {
    table = tables.find((t) => t.url === fk.reference.resource);
    if (!table) {
      issueTracker.addError(`Table ${fk.reference.resource} not found`);
    }
  } else if (fk.reference.schemaReference) {
    table = tables.find(
      (t) => t.tableSchema?.['@id'] === fk.reference.schemaReference
    );
    if (!table) {
      issueTracker.addError(
        `Schema ${fk.reference.schemaReference} not found in tables`
      );
    }
  }
  if (!table) {
    issueTracker.addError('Table not found');
    return;
  }

  const remoteRef = coerceArray(fk.reference.columnReference);
  for (const col of remoteRef) {
    if (!table.tableSchema?.columns?.some((c) => c.name === col)) {
      issueTracker.addError(`Column ${col} not found in table ${table.url}`);
    }
  }
}
