import { Bindings, ResultStream } from '@rdfjs/types';
import { Readable } from 'stream';
import {
  convertColumnToDateFormattedColumn,
  formatDate,
  isDateFormatedColumn,
} from './utils/date-formatting.js';
import { CsvwTableDescriptionWithRequiredColumns } from './types/descriptor/table.js';
import {
  convertColumnToNumberFormattedColumn,
  isNumberColumn,
  transformNumber,
} from './utils/number-formating.js';
import { IssueTracker } from './utils/issue-tracker.js';
import { DataFactory } from 'rdf-data-factory';
import { trimUrl } from './utils/url-trimming.js';
import { CsvwColumn } from './rdf2csvw-convertor.js';
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
      if (isDateFormatedColumn(columnDescription)) {
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
      } else if (isNumberColumn(columnDescription)) {
        const convertedNumberColumn =
          convertColumnToNumberFormattedColumn(columnDescription);
        if (convertedNumberColumn) {
          const formattedValue = transformNumber(
            value,
            convertedNumberColumn,
            issueTracker
          );
          bindings = bindings.set(
            columns[i].queryVariable,
            factory.literal(formattedValue)
          );
        }
      } else if (columnDescription.valueUrl) {
        const formattedValue = trimUrl(
          value,
          columnDescription.valueUrl,
          columns[i].title,
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
