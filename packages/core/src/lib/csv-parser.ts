import { type Transformer } from 'stream/web';
import { CsvwDialectDescription } from './descriptor/dialect-description.js';
import { Expanded } from './descriptor/expanded.js';
import { parse } from 'csv/browser/esm';

export class CSVParser extends TransformStream<string, string[]> {
  constructor(dialect: Expanded<CsvwDialectDescription>) {
    super(CSVParser.createTransformer(dialect));
  }

  private static initCSVParser(dialect: Expanded<CsvwDialectDescription>) {
    const trim =
      dialect['http://www.w3.org/ns/csvw#trim'] ??
      (dialect['http://www.w3.org/ns/csvw#skipInitialSpace'] ? 'start' : false);
    return parse({
      cast: false,
      comment: dialect['http://www.w3.org/ns/csvw#commentPrefix'] ?? '#',
      delimiter: dialect['http://www.w3.org/ns/csvw#delimiter'] ?? ',',
      escape: dialect['http://www.w3.org/ns/csvw#doubleQuote'] ? '"' : '\\',
      encoding:
        (dialect['http://www.w3.org/ns/csvw#encoding'] as BufferEncoding) ??
        'utf-8',
      columns: undefined,
      from_line: dialect['http://www.w3.org/ns/csvw#skipRows'] ?? 1,
      record_delimiter: dialect[
        'http://www.w3.org/ns/csvw#lineTerminators'
      ] ?? ['\r\n', '\n'],
      quote: dialect['http://www.w3.org/ns/csvw#quoteChar'] ?? '"',
      skip_empty_lines:
        dialect['http://www.w3.org/ns/csvw#skipBlankRows'] ?? false,
      ltrim: ['start', 'true', true].includes(trim),
      rtrim: ['end', 'true', true].includes(trim),
      on_record: dialect['http://www.w3.org/ns/csvw#skipColumns']
        ? (record) =>
            record.slice(dialect['http://www.w3.org/ns/csvw#skipColumns'])
        : undefined,
    });
  }

  private static createTransformer(
    dialect: Expanded<CsvwDialectDescription>
  ): Transformer {
    const parser = this.initCSVParser(dialect);
    return {
      start(controller) {
        parser.on('readable', () => {
          let record;
          while ((record = parser.read())) {
            controller.enqueue(record);
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
    };
  }
}
