import { CsvwColumnWithQueryVar, CsvwRow } from './convertor.js';
import { formatBoolean, isBooleanColumn } from '../utils/format-boolean.js';
import { isNumericColumn, formatNumber } from '../utils/format-number.js';
import { isDateTimeColumn, formatDateTime } from '../utils/format-datetime.js';
import { formatOther } from '../utils/format-other.js';
import { trimUrl } from '../utils/url-trimming.js';
import { commonPrefixes } from '../utils/prefix.js';
import { expandIri } from '../utils/expand-iri.js';
import { IssueTracker } from '../utils/issue-tracker.js';
import { CsvwTableDescriptionWithRequiredColumns } from '../types/descriptor/table.js';
import { Readable } from 'readable-stream';
import { Bindings, ResultStream } from '@rdfjs/types';

const { rdf } = commonPrefixes;

export function transformStream(
  stream: ResultStream<Bindings>,
  tableDescription: CsvwTableDescriptionWithRequiredColumns,
  columns: CsvwColumnWithQueryVar[],
  issueTracker: IssueTracker,
): Readable {
  const transformedStream = new Readable({
    objectMode: true,
    read() {
      // no-op
    },
  });
  //This part is called when the stream is piped to another stream and gets data.
  stream.on('data', (bindings: Bindings) => {
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
          row[columns[i].name] = '';
        } else if (columnDescription.null instanceof Array) {
          row[columns[i].name] = columnDescription.null[0];
        } else {
          row[columns[i].name] = columnDescription.null;
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
        value = formatNumber(value, columnDescription, issueTracker);
      } else if (isDateTimeColumn(columnDescription)) {
        value = formatDateTime(value, columnDescription, issueTracker);
        // TODO: format durations and other types
      } else {
        value = formatOther(value, columnDescription, issueTracker);
      }

      row[columns[i].name] = value;
    }

    transformedStream.push(row);
  });

  stream.on('end', () => {
    transformedStream.push(null);
  });

  stream.on('error', (err) => {
    transformedStream.destroy(err);
  });

  return transformedStream;
}
