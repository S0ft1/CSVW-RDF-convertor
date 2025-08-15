import { IssueTracker } from './issue-tracker.js';
import { CsvwColumnDescription } from '../types/descriptor/column-description.js';

export function formatOther(
  value: string,
  column: CsvwColumnDescription,
  issueTracker: IssueTracker,
) {
  if (
    typeof column.datatype !== 'string' &&
    (typeof column.datatype?.format === 'string' ||
      column.datatype?.format instanceof RegExp)
  ) {
    const regex = new RegExp(column.datatype.format);
    if (!regex.test(value)) {
      issueTracker.addWarning(
        `The value "${value}" does not match format "${regex}".`,
        true,
      );
    }
  }
  return value;
}
