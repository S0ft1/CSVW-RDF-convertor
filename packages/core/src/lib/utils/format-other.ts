import { IssueTracker } from './issue-tracker.js';
import { CsvwColumnDescription } from '../types/descriptor/column-description.js';

export function formatOther(
  value: string,
  column: CsvwColumnDescription,
  issueTracker: IssueTracker,
) {
  if (column.datatype !== undefined && typeof column.datatype !== 'string') {
    if (
      column.datatype.format !== undefined &&
      !(column.datatype.format as RegExp).test(value)
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
