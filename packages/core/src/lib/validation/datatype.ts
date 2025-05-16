import { ValidationContext } from './context.js';
import {
  CsvwDatatype,
  CsvwNumberFormat,
} from '../types/descriptor/datatype.js';
import { CsvwInheritedProperties } from '../types/descriptor/inherited-properties.js';
import { parseDate } from '../utils/parse-date.js';
import {
  commonPrefixes,
  dateTypes,
  dtUris,
  numericTypes,
  stringTypes,
} from '../utils/prefix.js';
import { PropertySchema, validateObject } from './generic.js';

const { xsd, rdf, csvw } = commonPrefixes;

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
  ctx: ValidationContext
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
  validateDatatypeId(dt, ctx);
  if (dt.base && !(dt.base in dtUris)) {
    ctx.issueTracker.addWarning(
      `Datatype "${dt.base}" is not a valid datatype.`
    );
    dt.base = 'string';
  }
  validateLengthConstraints(dt, ctx);
  validateMinMaxConstraints(dt, ctx);
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

function validateLengthConstraints(dt: CsvwDatatype, ctx: ValidationContext) {
  const base = dt.base ?? 'string';
  // undefined < and > comparisons always return false, so we can afford to do this
  const { length, minLength, maxLength } = dt as Required<CsvwDatatype>;

  if (
    (length ?? minLength ?? maxLength) !== undefined &&
    !stringTypes.has(xsd + base) &&
    !['json', 'html', 'xml'].includes(base)
  ) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" cannot have length, minLength or maxLength constraints.`
    );
  }

  if (length < minLength) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" length (${length}) is less than minLength (${minLength}).`
    );
  }
  if (length > maxLength) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" length (${length}) is greater than maxLength (${maxLength}).`
    );
  }
  if (minLength > maxLength) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" minLength (${minLength}) is greater than maxLength (${maxLength}).`
    );
  }
}

function validateMinMaxConstraints(dt: CsvwDatatype, ctx: ValidationContext) {
  const base = dt.base ?? 'string';
  // undefined < and > comparisons always return false, so we can afford to do this
  let minExclusive = dt.minExclusive as number | string | Date;
  let maxExclusive = dt.maxExclusive as number | string | Date;
  let minimum = (dt.minimum ?? dt.minInclusive) as number | string | Date;
  let maximum = (dt.maximum ?? dt.maxInclusive) as number | string | Date;

  if (
    (minExclusive ?? maxExclusive ?? minimum ?? maximum) !== undefined &&
    !numericTypes.has(xsd + base) &&
    !dateTypes.has(xsd + base)
  ) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" cannot have minimum or maximum constraints.`
    );
  }

  if (dateTypes.has(xsd + base)) {
    if (minExclusive !== undefined) {
      minExclusive = parseDate(minExclusive as string, dt.base as string);
    }
    if (maxExclusive !== undefined) {
      maxExclusive = parseDate(maxExclusive as string, dt.base as string);
    }
    if (minimum !== undefined) {
      minimum = parseDate(minimum as string, dt.base as string);
    }
    if (maximum !== undefined) {
      maximum = parseDate(maximum as string, dt.base as string);
    }
  }

  if (minimum !== undefined && minExclusive !== undefined) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" minInclusive (${minimum}) and minExclusive (${minExclusive}) cannot be used together.`
    );
  }
  if (maximum !== undefined && maxExclusive !== undefined) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" maxInclusive (${maximum}) and maxExclusive (${maxExclusive}) cannot be used together.`
    );
  }

  if (maximum < minimum) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" maxInclusive (${maximum}) is less than minInclusive (${minimum}).`
    );
  }
  if (maxExclusive <= minimum) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" maxExclusive (${maxExclusive}) is less than or equal to minInclusive (${minimum}).`
    );
  }
  if (maximum <= minExclusive) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" maxInclusive (${maximum}) is less than or equal to minExclusive (${minExclusive}).`
    );
  }
  if (maxExclusive <= minExclusive) {
    ctx.issueTracker.addError(
      `Datatype "${dt.base}" maxExclusive (${maxExclusive}) is less than or equal to minExclusive (${minExclusive}).`
    );
  }
}

function validateDatatypeId(dt: CsvwDatatype, ctx: ValidationContext) {
  if (!dt['@id']) return;
  const id = dt['@id']
    .replace(/^xsd:/, xsd)
    .replace(/^rdf:/, rdf)
    .replace(/^csvw:/, csvw);
  if (Object.values(dtUris).includes(id)) {
    ctx.issueTracker.addError(
      `Datatype @id "${dt['@id']}" must not be a builtin datatype.`
    );
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
