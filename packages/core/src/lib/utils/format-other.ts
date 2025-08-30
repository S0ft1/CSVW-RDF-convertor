import { IssueTracker } from './issue-tracker.js';
import { CsvwColumnDescription } from '../types/descriptor/column-description.js';

export function getOtherFilter(
  value: string,
  column: CsvwColumnDescription,
): string | undefined {
  if (column.datatype !== undefined && typeof column.datatype !== 'string') {
    if (
      column.datatype.format !== undefined ||
      column.datatype.length !== undefined ||
      column.datatype.minLength !== undefined ||
      column.datatype.maxLength !== undefined
    ) {
      const constraints = [];

      if (column.datatype.format !== undefined) {
        constraints.push(
          `REGEX(STR(${value}), "${typeof column.datatype.format === 'string' ? column.datatype.format : (column.datatype.format as RegExp).source}")`,
        );
      }
      if (column.datatype.length !== undefined) {
        constraints.push(`STRLEN(STR(${value})) = ${column.datatype.length}`);
      }
      if (column.datatype.minLength !== undefined) {
        constraints.push(
          `STRLEN(STR(${value})) >= ${column.datatype.minLength}`,
        );
      }
      if (column.datatype.maxLength !== undefined) {
        constraints.push(
          `STRLEN(STR(${value})) <= ${column.datatype.maxLength}`,
        );
      }

      return `FILTER (${constraints.join(' && ')})`;
    }
  }

  return undefined;
}

export function formatOther(
  value: string,
  column: CsvwColumnDescription,
  issueTracker: IssueTracker,
) {
  if (column.datatype !== undefined && typeof column.datatype !== 'string') {
    if (
      column.datatype.format !== undefined &&
      !new RegExp(column.datatype.format as string | RegExp).test(value)
    ) {
      issueTracker.addWarning(
        `The value "${value}" does not match the format "${column.datatype.format}".`,
        true,
      );
    }

    // TODO: Does this length comparison works for binary type?
    if (
      column.datatype.length !== undefined &&
      value.length !== column.datatype.length
    ) {
      issueTracker.addWarning(
        `The value "${value}" does not have the exact length "${column.datatype.length}".`,
        true,
      );
    }
    if (
      column.datatype.minLength !== undefined &&
      value.length < column.datatype.minLength
    ) {
      issueTracker.addWarning(
        `The value "${value}" is shorter than the minimum length "${column.datatype.minLength}".`,
        true,
      );
    }
    if (
      column.datatype.maxLength !== undefined &&
      value.length > column.datatype.maxLength
    ) {
      issueTracker.addWarning(
        `The value "${value}" is longer than the maximum length "${column.datatype.maxLength}".`,
        true,
      );
    }
  }

  return value;
}
