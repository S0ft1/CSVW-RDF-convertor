import { CsvwColumn } from './rdf2csvw-convertor.js';
import { formatBoolean, isBooleanColumn } from './utils/format-boolean.js';
import { isNumericColumn, formatNumber } from './utils/format-number.js';
import { isDateTimeColumn, formatDateTime } from './utils/format-datetime.js';
import { formatOther } from './utils/format-other.js'
import { trimUrl } from './utils/url-trimming.js';
import { IssueTracker } from './utils/issue-tracker.js';
import { CsvwTableDescriptionWithRequiredColumns } from './types/descriptor/table.js';
import { Readable } from 'readable-stream';
import { DataFactory } from 'rdf-data-factory';
import { Bindings, ResultStream } from '@rdfjs/types';
import { Term } from 'n3';
const factory = new DataFactory();

export function transformStream(
  stream: ResultStream<Bindings>,
  tableDescription: CsvwTableDescriptionWithRequiredColumns,
  columns: CsvwColumn[],
  issueTracker: IssueTracker
): ResultStream<Bindings> {
  const transformedStream = new Readable({
    objectMode: true,
    read() {
      // no-op
    },
  });
  //This part is called when the stream is piped to another stream and gets data.
  stream.on('data', (bindings: Bindings) => {
    for (
      let i = 0;
      i < tableDescription.tableSchema.columns.length &&
      !tableDescription.tableSchema.columns[i].virtual;
      i++
    ) {
      const columnDescription = tableDescription.tableSchema.columns[i];
      if (!bindings.get(columns[i].queryVariable)) {
        if (columnDescription.null) {
          if (columnDescription.null instanceof Array) {
            bindings = bindings.set(
              columns[i].queryVariable,
              factory.literal(columnDescription.null[0])
            );
          } else {
            bindings = bindings.set(
              columns[i].queryVariable,
              factory.literal(columnDescription.null)
            );
          }
        } else {
          continue;
        }
      }

      const term = bindings.get(columns[i].queryVariable) as Term;
      const value = term.value;
      if (isBooleanColumn(columnDescription)) {
        const formattedValue = formatBoolean(
          value,
          columnDescription,
          issueTracker,
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue),
        );
      } else if (isNumericColumn(columnDescription)) {
        const formattedValue = formatNumber(
          value,
          columnDescription,
          issueTracker,
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue),
        );
      } else if (isDateTimeColumn(columnDescription)) {
        const formattedValue = formatDateTime(
          value,
          columnDescription,
          issueTracker
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue)
        );
      // TODO: format durations and other types
      } else {
        const formattedValue = formatOther(
          value,
          columnDescription,
          issueTracker,
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue),
        );
      }

      if (columnDescription.valueUrl) {
        const formattedValue = trimUrl(
          value,
          columnDescription.valueUrl,
          columns[i].name,
          issueTracker
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue)
        );
      } else if (tableDescription.aboutUrl) {
        const formattedValue = trimUrl(
          value,
          tableDescription.aboutUrl,
          columns[i].name,
          issueTracker
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue)
        );
      }
    }
    transformedStream.push(bindings);
  });

  stream.on('end', () => {
    transformedStream.push(null);
  });

  stream.on('error', (err) => {
    transformedStream.destroy(err);
  });

  return transformedStream;
}
