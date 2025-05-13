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
