import { type Transformer } from 'stream/web';
import { CsvwDialectDescription } from './types/descriptor/dialect-description.js';
import { Expanded } from './types/descriptor/expanded.js';
import { parse } from 'csv/browser/esm';

export class CSVParser extends TransformStream<string, string[]> {
  constructor(dialect: CsvwDialectDescription) {
    super(CSVParser.createTransformer(dialect));
  }

  private static initCSVParser(dialect: CsvwDialectDescription) {
    const trim = dialect.trim ?? (dialect.skipInitialSpace ? 'start' : false);
    return parse({
      cast: false,
      comment: dialect.commentPrefix,
      delimiter: dialect.delimiter ?? ',',
      escape: (dialect.doubleQuote ?? true) ? '"' : '\\',
      encoding: (dialect.encoding as BufferEncoding) ?? 'utf-8',
      columns: undefined,
      from_line: (dialect.skipRows ?? 0) + 1,
      record_delimiter: dialect.lineTerminators ?? ['\r\n', '\n'],
      quote: dialect.quoteChar ?? '"',
      skip_empty_lines: dialect.skipBlankRows ?? false,
      ltrim: ['start', 'true', true].includes(trim),
      rtrim: ['end', 'true', true].includes(trim),
      on_record: dialect.skipColumns
        ? (record) => record.slice(dialect.skipColumns)
        : undefined,
    });
  }

  private static createTransformer(
    dialect: Expanded<CsvwDialectDescription>,
  ): Transformer<string, string[]> {
    const parser = this.initCSVParser(dialect);
    return {
      start(controller) {
        parser.on('readable', () => {
          let record;
          while ((record = parser.read())) {
            controller.enqueue(record);
            record = parser.read();
          }
        });
        parser.on('error', (error) => {
          controller.error(error);
        });
        parser.on('end', () => {
          controller.terminate();
        });
      },
      transform(chunk) {
        parser.write(chunk);
      },
      flush() {
        parser.end();
      },
    };
  }
}
