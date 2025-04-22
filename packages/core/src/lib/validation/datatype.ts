import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import { CsvwNumberFormat } from '../types/descriptor/datatype.js';
import { CsvwInheritedProperties } from '../types/descriptor/inherited-properties.js';
import {
  commonPrefixes,
  dateTypes,
  dtUris,
  numericTypes,
} from '../utils/prefix.js';
import { PropertySchema, validateObject } from './generic.js';

const { xsd } = commonPrefixes;

const numberPatternRegex = /^[0#,.eE+%‰-]+$/;
const numberFormatSchema: Partial<
  Record<keyof CsvwNumberFormat, PropertySchema>
> = {
  decimalChar: { type: 'string', default: '.' },
  groupChar: { type: 'string', default: ',' },
  pattern: {
    type: 'string',
    validate: (val) => !!val.match(numberPatternRegex),
  },
};

/**
 * Validate datatype formats of the column descriptions in the table.
 * @param table - Table description
 */
export function validateDatatype(
  props: CsvwInheritedProperties,
  ctx: Csvw2RdfContext
) {
  const dt = props.datatype;
  if (dt === undefined) return;
  if (typeof dt === 'string') {
    if (!(dt in dtUris)) {
      ctx.issueTracker.addWarning(`Datatype "${dt}" is not a valid datatype.`);
      delete props.datatype;
    }
    return;
  }
  if (dt.base && !(dt.base in dtUris)) {
    ctx.issueTracker.addWarning(
      `Datatype "${dt.base}" is not a valid datatype.`
    );
    dt.base = 'string';
  }
  if (!dt.base || !dt.format) return;

  if (numericTypes.has(xsd + dt.base)) {
    if (typeof dt.format === 'string') {
      dt.format = { pattern: dt.format };
    }
    validateObject(dt.format, numberFormatSchema, 'NumberFormat', ctx);
    return;
  }
  if (typeof dt.format !== 'string') {
    ctx.issueTracker.addWarning(
      `Datatype "${
        dt.base
      }" format is of type ${typeof dt.format}, expected string.`
    );
    dt.format = undefined;
    return;
  }

  if (dt.base === 'boolean') {
    if (!dt.format.includes('|')) {
      ctx.issueTracker.addWarning(
        `Datatype "${dt.base}" format is "${dt.format}", should be string with "|" separator.`
      );
      dt.format = undefined;
    }
    return;
  }

  if (!dateTypes.has(xsd + dt.base) && dt.base !== 'datetime') {
    try {
      dt.format = new RegExp(dt.format);
    } catch {
      ctx.issueTracker.addWarning(
        `Datatype "${dt.base}" format is "${dt.format}", should be a valid regex.`
      );
      dt.format = undefined;
    }
  }
}
