import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import {
  CsvwDatatype,
  CsvwNumberFormat,
} from '../types/descriptor/datatype.js';
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

const datatypeSchema: Partial<Record<keyof CsvwDatatype, PropertySchema>> = {
  length: { type: 'number' },
  minLength: { type: 'number' },
  maxLength: { type: 'number' },
  minimum: { type: ['string', 'number'] },
  maximum: { type: ['string', 'number'] },
  minInclusive: { type: ['string', 'number'] },
  maxInclusive: { type: ['string', 'number'] },
  minExclusive: { type: ['string', 'number'] },
  maxExclusive: { type: ['string', 'number'] },
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
    } else {
      props.datatype = { base: dt };
      setupDefaultFormats(dt, props.datatype);
    }
    return;
  }
  if (dt.base && !(dt.base in dtUris)) {
    ctx.issueTracker.addWarning(
      `Datatype "${dt.base}" is not a valid datatype.`
    );
    dt.base = 'string';
  }
  if (dt.base && !dt.format) {
    setupDefaultFormats(dt.base, dt);
    if (dt.format) return; // setup ok
  }
  if (!dt.base || !dt.format) return;

  validateObject(dt, datatypeSchema, 'Datatype', ctx);

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

function setupDefaultFormats(dtUri: string, dt: CsvwDatatype) {
  dt.format = {
    duration:
      /^-?P([0-9]+Y)?([0-9]+M)?([0-9]+D)?(T([0-9]+H)?([0-9]+M)?([0-9]+(\.[0-9]+)?S)?)?$/,
    dayTimeDuration:
      /^-?P([0-9]+D)?(T([0-9]+H)?([0-9]+M)?([0-9]+(\.[0-9]+)?S)?)?$/,
    yearMonthDuration: /^-?P([0-9]+Y)?([0-9]+M)?$/,
    base64Binary:
      /^((([A-Za-z0-9+/] ?){4})*(([A-Za-z0-9+/] ?){3}[A-Za-z0-9+/]|([A-Za-z0-9+/] ?){2}[AEIMQUYcgkosw048] ?=|[A-Za-z0-9+/] ?[AQgw] ?= ?=))?$/,
    hexBinary: /^([0-9A-Fa-f]{2})*$/,
  }[dtUri];
}
