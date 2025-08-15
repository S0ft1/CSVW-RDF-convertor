import {
  CsvwColumnDescription,
  CsvwColumnDescriptionWithNumericDatatype,
} from '../types/descriptor/column-description.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from '../types/descriptor/datatype.js';
import { IssueTracker } from './issue-tracker.js';
import ldmlnum from 'ldml-number';

type NumericDatatypeValidation = {
  regex: RegExp;
  minInclusive?: number | bigint;
  maxInclusive?: number | bigint;
  minExclusive?: number | bigint;
  maxExclusive?: number | bigint;
};

const numericDatatypePatterns: {
  [datatype: string]: NumericDatatypeValidation;
} = {
  decimal: {
    regex: /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)$/,
  },
  integer: {
    regex: /^[-+]?[0-9]+$/,
  },
  long: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: -9223372036854775808n,
    maxInclusive: 9223372036854775807n,
  },
  int: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: -2147483648,
    maxInclusive: 2147483647,
  },
  short: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: -32768,
    maxInclusive: 32767,
  },
  byte: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: -128,
    maxInclusive: 127,
  },
  nonNegativeInteger: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: 0,
  },
  positiveInteger: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: 1,
  },
  unsignedLong: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: 0,
    maxInclusive: 18446744073709551615n,
  },
  unsignedInt: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: 0,
    maxInclusive: 4294967295,
  },
  unsignedShort: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: 0,
    maxInclusive: 65535,
  },
  unsignedByte: {
    regex: /^[-+]?[0-9]+$/,
    minInclusive: 0,
    maxInclusive: 255,
  },
  nonPositiveInteger: {
    regex: /^[-+]?[0-9]+$/,
    maxInclusive: 0,
  },
  negativeInteger: {
    regex: /^[-+]?[0-9]+$/,
    maxInclusive: -1,
  },
  double: {
    regex:
      /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)?$|^(\+|-)?INF$|^NaN$/,
  },
  number: {
    regex:
      /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)?$|^(\+|-)?INF$|^NaN$/,
  },
  float: {
    regex:
      /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)?$|^(\+|-)?INF$|^NaN$/,
  },
};

function constraintToNumber(
  value: string | number | undefined,
): number | undefined {
  if (typeof value === 'string') {
    if (value === 'INF') return Infinity;
    if (value === '-INF') return -Infinity;
    return +value;
  }
  return value;
}

export function isNumericColumn(
  column: CsvwColumnDescription,
): column is CsvwColumnDescriptionWithNumericDatatype {
  if (column.datatype === undefined) {
    return false;
  } else if (typeof column.datatype === 'string') {
    const datatype = column.datatype as CsvwBuiltinDatatype;
    return Object.keys(numericDatatypePatterns).some(
      (type) => type === datatype,
    );
  } else {
    const datatype = column.datatype as CsvwDatatype;
    return Object.keys(numericDatatypePatterns).some(
      (type) => type === datatype.base,
    );
  }
}

export function formatNumber(
  value: string,
  column: CsvwColumnDescriptionWithNumericDatatype,
  issueTracker: IssueTracker,
): string {
  value = value.trim();

  let validation: NumericDatatypeValidation;
  if (typeof column.datatype === 'string') {
    // validation must be cloned since it is later updated
    validation = { ...numericDatatypePatterns[column.datatype] };
  } else {
    // validation must be cloned since it is later updated
    validation = { ...numericDatatypePatterns[column.datatype.base] };

    validation.minInclusive =
      constraintToNumber(
        column.datatype.minimum ?? column.datatype.minInclusive,
      ) ?? validation.minInclusive;
    validation.maxInclusive =
      constraintToNumber(
        column.datatype.maximum ?? column.datatype.maxExclusive,
      ) ?? validation.maxInclusive;
    validation.minExclusive =
      constraintToNumber(column.datatype.minExclusive) ??
      validation.minExclusive;
    validation.maxExclusive =
      constraintToNumber(column.datatype.maxExclusive) ??
      validation.maxExclusive;
  }

  if (!validation.regex.test(value)) {
    issueTracker.addWarning(
      `The value "${value}" does not match ${typeof column.datatype === 'string' ? column.datatype : column.datatype.base} type.`,
      true,
    );
    return value;
  }
  if (!isNaN(+value)) {
    if (
      validation.minInclusive !== undefined &&
      +value < validation.minInclusive
    ) {
      issueTracker.addWarning(
        `The value "${value}" is less than inclusive minimum.`,
        true,
      );
    }
    if (
      validation.maxInclusive !== undefined &&
      +value > validation.maxInclusive
    ) {
      issueTracker.addWarning(
        `The value "${value}" is greater than inclusive maximum.`,
        true,
      );
    }
    if (
      validation.minExclusive !== undefined &&
      +value <= validation.minExclusive
    ) {
      issueTracker.addWarning(
        `The value "${value}" is less than or equal to exclusive minimum.`,
        true,
      );
    }
    if (
      validation.maxExclusive !== undefined &&
      +value >= validation.maxExclusive
    ) {
      issueTracker.addWarning(
        `The value "${value}" is greater than or equal to exclusive maximum.`,
        true,
      );
    }
  }

  let pattern: string | undefined;
  if (
    typeof column.datatype !== 'string' &&
    column.datatype.format !== undefined
  ) {
    if (typeof column.datatype.format === 'string')
      pattern = column.datatype.format;
    else pattern = column.datatype.format.pattern;
  }

  ldmlnum.locale.csvw = ldmlnum.locale(',', '.', '+', '-', 'E', 'INF', 'NaN');
  if (
    typeof column.datatype !== 'string' &&
    typeof column.datatype.format !== 'string'
  ) {
    ldmlnum.locale.csvw.thousands_separator =
      column.datatype.format?.groupChar ?? ',';
    ldmlnum.locale.csvw.decimal_separator =
      column.datatype.format?.decimalChar ?? '.';
  }

  if (pattern === undefined) {
    return value.replace('.', ldmlnum.locale.csvw.decimal_separator);
  }

  try {
    const format_fn = ldmlnum(pattern, 'csvw');
    const formatted = format_fn(+value);
    return formatted;
  } catch {
    issueTracker.addError(
      `Invalid numeric format pattern "${pattern}", take a look at https://www.unicode.org/reports/tr35/tr35-39/tr35-numbers.html#Number_Patterns`,
      true,
    );
    return value.replace('.', ldmlnum.locale.csvw.decimal_separator);
  }
}
