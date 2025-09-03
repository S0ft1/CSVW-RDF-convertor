import {
  CsvwColumnDescriptionWithDurationDatatype,
  CsvwColumnDescription,
} from '../types/descriptor/column-description.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from '../types/descriptor/datatype.js';
import { IssueTracker } from './issue-tracker.js';
import { dtUris } from './prefix.js';
import { parseDuration } from './parse-duration.js';
import { Duration } from 'date-fns';

type DateTimeDatatypeValidation = {
  regex: RegExp;
  minInclusive?: Duration;
  maxInclusive?: Duration;
  minExclusive?: Duration;
  maxExclusive?: Duration;
};

const durationDatatypePatterns: {
  [datatype: string]: RegExp;
} = {
  duration:
    /^-?P([0-9]+Y)?([0-9]+M)?([0-9]+D)?(T([0-9]+H)?([0-9]+M)?([0-9]+(\.[0-9]+)?S)?)?$/,
  dayTimeDuration:
    /^-?P([0-9]+D)?(T([0-9]+H)?([0-9]+M)?([0-9]+(\.[0-9]+)?S)?)?$/,
  yearMonthDuration: /^-?P([0-9]+Y)?([0-9]+M)?$/,
};

export function isDurationColumn(
  column: CsvwColumnDescription,
): column is CsvwColumnDescriptionWithDurationDatatype {
  if (column.datatype === undefined) {
    return false;
  } else if (typeof column.datatype === 'string') {
    const datatype = column.datatype as CsvwBuiltinDatatype;
    return Object.keys(durationDatatypePatterns).some(
      (type) => type === datatype,
    );
  } else {
    const datatype = column.datatype as CsvwDatatype;
    return Object.keys(durationDatatypePatterns).some(
      (type) => type === datatype.base,
    );
  }
}

export function getDurationFilter(
  value: string,
  column: CsvwColumnDescriptionWithDurationDatatype,
): string | undefined {
  if (column.datatype !== undefined && typeof column.datatype !== 'string') {
    if (
      column.datatype.minimum !== undefined ||
      column.datatype.maximum !== undefined ||
      column.datatype.minInclusive !== undefined ||
      column.datatype.maxInclusive !== undefined ||
      column.datatype.minExclusive !== undefined ||
      column.datatype.maxExclusive !== undefined
    ) {
      const constraints = [];

      if (column.datatype.minimum !== undefined)
        constraints.push(
          `${value} >= "${column.datatype.minimum}"^^<${dtUris[column.datatype.base]}>`,
        );
      if (column.datatype.maximum !== undefined)
        constraints.push(
          `${value} <= "${column.datatype.maximum}"^^<${dtUris[column.datatype.base]}>`,
        );
      if (column.datatype.minInclusive !== undefined)
        constraints.push(
          `${value} >= "${column.datatype.minInclusive}"^^<${dtUris[column.datatype.base]}>`,
        );
      if (column.datatype.maxInclusive !== undefined)
        constraints.push(
          `${value} <= "${column.datatype.maxInclusive}"^^<${dtUris[column.datatype.base]}>`,
        );
      if (column.datatype.minExclusive !== undefined)
        constraints.push(
          `${value} > "${column.datatype.minExclusive}"^^<${dtUris[column.datatype.base]}>`,
        );
      if (column.datatype.maxExclusive !== undefined)
        constraints.push(
          `${value} < "${column.datatype.maxExclusive}"^^<${dtUris[column.datatype.base]}>`,
        );

      return `FILTER (${constraints.join(' && ')})`;
    }
  }
  return undefined;
}

export function formatDuration(
  value: string,
  column: CsvwColumnDescriptionWithDurationDatatype,
  issueTracker: IssueTracker,
): string {
  value = value.trim();

  let validation: DateTimeDatatypeValidation;
  if (typeof column.datatype === 'string') {
    validation = { regex: durationDatatypePatterns[column.datatype] };
  } else {
    validation = {
      regex: durationDatatypePatterns[column.datatype.base],
    };

    if (column.datatype.format !== undefined) {
      validation.regex = new RegExp(column.datatype.format);
    }

    if (typeof column.datatype.minimum === 'string')
      validation.minInclusive = parseDuration(column.datatype.minimum);
    if (typeof column.datatype.maximum === 'string')
      validation.maxInclusive = parseDuration(column.datatype.maximum);
    if (typeof column.datatype.minInclusive === 'string')
      validation.minInclusive = parseDuration(column.datatype.minInclusive);
    if (typeof column.datatype.maxInclusive === 'string')
      validation.maxInclusive = parseDuration(column.datatype.maxInclusive);
    if (typeof column.datatype.minExclusive === 'string')
      validation.minExclusive = parseDuration(column.datatype.minExclusive);
    if (typeof column.datatype.maxExclusive === 'string')
      validation.maxExclusive = parseDuration(column.datatype.maxExclusive);
  }

  if (!validation.regex.test(value)) {
    issueTracker.addWarning(
      `The value "${value}" does not match ${typeof column.datatype === 'string' ? column.datatype : column.datatype.base} type.`,
      true,
    );
    return value;
  }

  const duration = parseDuration(value);

  if (
    validation.minInclusive !== undefined &&
    duration < validation.minInclusive
  ) {
    issueTracker.addWarning(
      `The value "${value}" is less than inclusive minimum.`,
      true,
    );
  }
  if (
    validation.maxInclusive !== undefined &&
    duration > validation.maxInclusive
  ) {
    issueTracker.addWarning(
      `The value "${value}" is greater than inclusive maximum.`,
      true,
    );
  }
  if (
    validation.minExclusive !== undefined &&
    duration <= validation.minExclusive
  ) {
    issueTracker.addWarning(
      `The value "${value}" is less than or equal to exclusive minimum.`,
      true,
    );
  }
  if (
    validation.maxExclusive !== undefined &&
    duration >= validation.maxExclusive
  ) {
    issueTracker.addWarning(
      `The value "${value}" is greater than or equal to exclusive maximum.`,
      true,
    );
  }

  return value;
}
