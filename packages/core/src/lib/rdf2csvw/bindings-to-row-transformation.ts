import { CsvwColumn, CsvwRow } from './convertor.js';
import { formatBoolean, isBooleanColumn } from '../utils/format-boolean.js';
import { isNumericColumn, formatNumeric } from '../utils/format-number.js';
import { isDateTimeColumn, formatDateTime } from '../utils/format-datetime.js';
import { isDurationColumn, formatDuration } from '../utils/format-duration.js';
import { formatOther } from '../utils/format-other.js';
import { trimUrl } from '../utils/url-trimming.js';
import { commonPrefixes } from '../utils/prefix.js';
import { expandIri } from '../utils/expand-iri.js';
import { IssueTracker } from '../utils/issue-tracker.js';
import { CsvwTableDescriptionWithRequiredColumns } from '../types/descriptor/table.js';
import { Bindings } from '@rdfjs/types';

const { rdf } = commonPrefixes;

export function transform(
  bindings: Bindings,
  tableDescription: CsvwTableDescriptionWithRequiredColumns,
  columns: CsvwColumn[],
  issueTracker: IssueTracker,
): CsvwRow {
  const row: CsvwRow = {};

  for (
    let i = 0;
    i < tableDescription.tableSchema.columns.length &&
    !tableDescription.tableSchema.columns[i].virtual;
    i++
  ) {
    const columnDescription = tableDescription.tableSchema.columns[i];

    const term = bindings.get(columns[i].queryVariable);
    if (!term) {
      if (columnDescription.null === undefined) {
        row[columns[i].title] = '';
      } else if (columnDescription.null instanceof Array) {
        row[columns[i].title] = columnDescription.null[0];
      } else {
        row[columns[i].title] = columnDescription.null;
      }
      continue;
    }

    let value = term.value;

    if (
      columnDescription.propertyUrl &&
      expandIri(columnDescription.propertyUrl) === rdf + 'type'
    ) {
      if (tableDescription.aboutUrl) {
        value = trimUrl(
          value,
          tableDescription.aboutUrl,
          columns[i].name,
          issueTracker,
        );
      }
    } else {
      if (columnDescription.valueUrl) {
        value = trimUrl(
          value,
          columnDescription.valueUrl,
          columns[i].name,
          issueTracker,
        );
      }
    }

    if (isBooleanColumn(columnDescription)) {
      value = formatBoolean(value, columnDescription, issueTracker);
    } else if (isNumericColumn(columnDescription)) {
      value = formatNumeric(value, columnDescription, issueTracker);
    } else if (isDateTimeColumn(columnDescription)) {
      value = formatDateTime(value, columnDescription, issueTracker);
    } else if (isDurationColumn(columnDescription)) {
      value = formatDuration(value, columnDescription, issueTracker);
    } else {
      value = formatOther(value, columnDescription, issueTracker);
    }

    row[columns[i].title] = value;
  }

  return row;
}
