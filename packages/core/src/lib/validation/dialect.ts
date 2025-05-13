import { ValidationContext } from './context.js';
import { CsvwDialectDescription } from '../types/descriptor/dialect-description.js';
import { coerceArray } from '../utils/coerce.js';
import {
  PropertySchema,
  validateAllowedKeys,
  validateType,
  validateObject,
} from './generic.js';

const dialectSchema: Partial<
  Record<keyof CsvwDialectDescription, PropertySchema>
> = {
  commentPrefix: { type: 'string' },
  delimiter: { type: 'string' },
  doubleQuote: { type: 'boolean' },
  encoding: { type: 'string', validate: Buffer.isEncoding },
  header: { type: 'boolean' },
  headerRowCount: { type: 'number', validate: (val) => val >= 0 },
  lineTerminators: { type: ['string', Array] },
  quoteChar: { type: ['string'] },
  skipBlankRows: { type: 'boolean' },
  skipColumns: { type: 'number', validate: (val) => val >= 0 },
  skipInitialSpace: { type: 'boolean' },
  skipRows: { type: 'number', validate: (val) => val >= 0 },
  trim: {
    type: ['boolean', 'string'],
    validate(value: unknown) {
      return (
        typeof value === 'boolean' ||
        value === 'true' ||
        value === 'false' ||
        value === 'start' ||
        value === 'end'
      );
    },
  },
};
const dialectKeys = [
  'commentPrefix',
  'delimiter',
  'doubleQuote',
  'encoding',
  'header',
  'headerRowCount',
  'lineTerminators',
  'notes',
  'quoteChar',
  'skipBlankRows',
  'skipColumns',
  'skipInitialSpace',
  'skipRows',
  'trim',
  '@id',
  '@type',
];

export function validateDialect(
  dialect: CsvwDialectDescription,
  ctx: ValidationContext
) {
  validateType(dialect, 'Dialect', ctx);
  validateObject(dialect, dialectSchema, 'Dialect', ctx);
  validateAllowedKeys(dialect, dialectKeys, 'Dialect', ctx);

  if (dialect.lineTerminators !== undefined) {
    dialect.lineTerminators = coerceArray(dialect.lineTerminators).filter(
      (t) => {
        if (typeof t === 'string') return true;
        ctx.issueTracker.addWarning(
          `removing invalid line terminator ${JSON.stringify(t)}`
        );
        return false;
      }
    );
  }
}
