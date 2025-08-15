import { format } from 'date-fns';
import {
  CsvwColumnDescriptionWithDateTimeDatatype,
  CsvwColumnDescription,
} from '../types/descriptor/column-description.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from '../types/descriptor/datatype.js';
import { IssueTracker } from './issue-tracker.js';

type DateTimeDatatypeValidation = {
  regex: RegExp;
  minInclusive?: Date;
  maxInclusive?: Date;
  minExclusive?: Date;
  maxExclusive?: Date;
};

const dateTimeDatatypePatterns: {
  [datatype: string]: RegExp;
} = {
  date: /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,

  dateTime:
    /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?|(24:00:00(\.0+)?))(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,

  datetime:
    /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?|(24:00:00(\.0+)?))(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,

  dateTimeStamp:
    /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?|(24:00:00(\.0+)?))(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$/,

  gDay: /^---(0[1-9]|[12][0-9]|3[01])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,

  gMonth: /^--(0[1-9]|1[0-2])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,

  gMonthDay:
    /^--(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,

  gYear:
    /^-?([1-9][0-9]{3,}|0[0-9]{3})(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,
  gYearMonth:
    /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,
  time: /^(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?|(24:00:00(\.0+)?))(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/,
};

export function isDateTimeColumn(
  column: CsvwColumnDescription,
): column is CsvwColumnDescriptionWithDateTimeDatatype {
  if (column.datatype === undefined) {
    return false;
  } else if (typeof column.datatype === 'string') {
    const datatype = column.datatype as CsvwBuiltinDatatype;
    return Object.keys(dateTimeDatatypePatterns).some(
      (type) => type === datatype,
    );
  } else {
    const datatype = column.datatype as CsvwDatatype;
    return Object.keys(dateTimeDatatypePatterns).some(
      (type) => type === datatype.base,
    );
  }
}

export function formatDateTime(
  value: string,
  column: CsvwColumnDescriptionWithDateTimeDatatype,
  issueTracker: IssueTracker,
): string {
  value = value.trim();

  let validation: DateTimeDatatypeValidation;
  if (typeof column.datatype === 'string') {
    validation = { regex: dateTimeDatatypePatterns[column.datatype] };
  } else {
    validation = { regex: dateTimeDatatypePatterns[column.datatype.base] };
    // TODO: set minimum, minInclusive, maximum, maxInclusive, minExclusive and maxExclusive
  }

  if (!validation.regex.test(value)) {
    issueTracker.addWarning(
      `The value "${value}" does not match ${typeof column.datatype === 'string' ? column.datatype : column.datatype.base} type.`,
      true,
    );
    return value;
  }

  // TODO: implement date and time parsing, this simple parsing does not support all possible types and formats
  const date = new Date(value);

  if (validation.minInclusive !== undefined && date < validation.minInclusive) {
    issueTracker.addWarning(
      `The value "${value}" is less than inclusive minimum.`,
      true,
    );
  }
  if (validation.maxInclusive !== undefined && date > validation.maxInclusive) {
    issueTracker.addWarning(
      `The value "${value}" is greater than inclusive maximum.`,
      true,
    );
  }
  if (
    validation.minExclusive !== undefined &&
    date <= validation.minExclusive
  ) {
    issueTracker.addWarning(
      `The value "${value}" is less than or equal to exclusive minimum.`,
      true,
    );
  }
  if (
    validation.maxExclusive !== undefined &&
    date >= validation.maxExclusive
  ) {
    issueTracker.addWarning(
      `The value "${value}" is greater than or equal to exclusive maximum.`,
      true,
    );
  }

  let pattern: string | undefined;
  if (typeof column.datatype !== 'string') {
    pattern = column.datatype.format;
  }

  if (pattern === undefined) {
    return value;
  }

  // TODO: implement formatting
  return format(date, pattern.replace(/T/g, "'T'")).toString();
}
