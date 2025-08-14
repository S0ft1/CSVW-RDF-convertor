import { Bindings, ResultStream } from '@rdfjs/types';
import {
  convertColumnToDateFormattedColumn,
  formatDate,
  isDateFormattedColumn,
} from './utils/date-formatting.js';
import {
  CsvwTableDescriptionWithRequiredColumns,
} from './types/descriptor/table.js';
import {
  isNumericColumn,
  formatNumber,
} from './utils/number-formatting.js';
import { IssueTracker } from './utils/issue-tracker.js';
import { DataFactory } from 'rdf-data-factory';
import { trimUrl } from './utils/url-trimming.js';
import { CsvwColumn } from './rdf2csvw-convertor.js';
import { Readable } from 'readable-stream';
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
  stream.on('data', (bindings) => {
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
      const value = bindings.get(columns[i].queryVariable).value;
      if (isDateFormattedColumn(columnDescription)) {
        const convertedDateColumn =
          convertColumnToDateFormattedColumn(columnDescription);
        if (convertedDateColumn) {
          const formattedValue = formatDate(
            value,
            convertedDateColumn.datatype.format
          );
          bindings = bindings.set(
            columns[i].queryVariable,
            factory.literal(formattedValue)
          );
        }
      } else if (isNumericColumn(columnDescription)) {
        const formattedValue = formatNumber(
          value,
          columnDescription,
          issueTracker
        );
        bindings = bindings.set(
          columns[i].queryVariable,
          factory.literal(formattedValue)
        );
      } else if (columnDescription.valueUrl) {
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
