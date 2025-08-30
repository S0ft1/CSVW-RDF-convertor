import {
  CsvwColumnDescription,
  CsvwColumnDescriptionWithBooleanDatatype,
} from '../types/descriptor/column-description.js';
import { IssueTracker } from './issue-tracker.js';

const formatPattern = new RegExp(/^[^|]+\|[^|]+$/);

export function isBooleanColumn(
  column: CsvwColumnDescription,
): column is CsvwColumnDescriptionWithBooleanDatatype {
  if (column.datatype === undefined) {
    return false;
  } else if (typeof column.datatype === 'string') {
    return column.datatype === 'boolean';
  } else {
    return column.datatype.base === 'boolean';
  }
}

export function getBooleanFilter(
  value: string,
  column: CsvwColumnDescriptionWithBooleanDatatype,
): string | undefined {
  return undefined;
}

export function formatBoolean(
  value: string,
  column: CsvwColumnDescriptionWithBooleanDatatype,
  issueTracker: IssueTracker,
): string {
  value = value.trim();

  let pattern = ['true', 'false'];

  if (
    typeof column.datatype !== 'string' &&
    column.datatype.format !== undefined
  ) {
    if (!formatPattern.test(column.datatype.format)) {
      issueTracker.addError(
        `Invalid boolean format pattern "${pattern}"`,
        true,
      );
    } else {
      pattern = column.datatype.format.split('|');
    }
  }

  if (value === 'true') {
    return pattern[0];
  } else if (value === 'false') {
    return pattern[1];
  } else {
    issueTracker.addWarning(
      `The value "${value}" does not match boolean.`,
      true,
    );
    return value;
  }
}
