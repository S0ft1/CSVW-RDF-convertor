import { Bindings, ResultStream } from "@rdfjs/types";
import { Readable } from "stream";
import { DescriptorWrapper } from "./descriptor.js";
import { CsvwColumnDescription } from "./types/descriptor/column-description.js";
import { convertColumnToDateFormattedColumn, formatDate, isDateFormatedColumn } from "./utils/date-formatting.js";
import { DataFactory, Literal } from "n3";
import { CsvwTableDescriptionWithRequiredColumns } from "./rdf2csvw-convertor.js";
import { convertColumnToNumberFormattedColumn, isNumberColumn, transformNumber } from "./utils/number-formating.js";
import { IssueTracker } from "./utils/issue-tracker.js";



export function transformStream(stream: ResultStream<Bindings>, tableDescription: CsvwTableDescriptionWithRequiredColumns, columnNames: string[], issueTracker: IssueTracker): ResultStream<Bindings> {

    const transformedStream = new Readable({
        objectMode: true,
        read() { }
    });

    //This part is called when the stream is piped to another stream and gets data.
    stream.on("data", (bindings) => {
        for (let i = 0; i < tableDescription.tableSchema.columns.length && !tableDescription.tableSchema.columns[i].virtual; i++) {
            const column = tableDescription.tableSchema.columns[i];
             if (!bindings.get(columnNames[i])) {
                continue;
            }
            let value = bindings.get(columnNames[i]).value;
            if (isDateFormatedColumn(column)) {
                let convertedDateColumn = convertColumnToDateFormattedColumn(column);
                if (convertedDateColumn) {
                    let formattedValue = formatDate(value, convertedDateColumn.datatype.format);
                    bindings = bindings.set(columnNames[i], new Literal(formattedValue));
                    break;
                }
            }
            else if (isNumberColumn(column)) {
                let convertedNumberColumn = convertColumnToNumberFormattedColumn(column);
                if (convertedNumberColumn) {
                    let formattedValue = transformNumber(value, convertedNumberColumn, issueTracker);
                    bindings = bindings.set(columnNames[i], new Literal(formattedValue));
                    break;
                }
            }
        }
        transformedStream.push(bindings);
    });


    stream.on("end", () => {
        transformedStream.push(null);
    });

    stream.on("error", (err) => {
        transformedStream.destroy(err);
    });

    return transformedStream;
}

