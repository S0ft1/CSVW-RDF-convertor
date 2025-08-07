import { SimpleTest } from './types/manifest.js';
import {
  CsvwColumn,
  CsvwTablesStream,
  defaultResolveJsonldFn,
  Rdf2CsvOptions,
  Rdf2CsvwConvertor,
} from '../src/index.js';
import { parse } from 'csv-parse';
import { isAbsolute, resolve } from 'node:path';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

type SimpleTestRow = Record<string, string>;
type SimpleTestTables = Record<string, SimpleTestRow[]>;

const testDir = resolve(fileURLToPath(import.meta.url), '../rdf2csvwtests');
const csvwDir = resolve(fileURLToPath(import.meta.url), '../../../../csvw');
const TEST_HTTP_BASE = 'http://example.com/';

const tests = JSON.parse(
  readFileSync(resolve(testDir, 'manifest.json'), 'utf-8'),
) as SimpleTest[];

describe('RDF -> CSVW with descriptor', () => {
  for (const entry of tests) {
    test(`#${entry.id}: ${entry.name}`, async () => {
      const options: Rdf2CsvOptions = {
        baseIri: resolve(testDir, entry.action, '..'),
        pathOverrides: [
          [
            'http://www.w3.org/ns/csvw',
            pathToFileURL(resolve(csvwDir, 'ns/csvw.jsonld')).href,
          ],
        ],
        resolveJsonldFn: loadJsonLd,
        resolveRdfStreamFn: loadStringStream,
      };
      const convertor = new Rdf2CsvwConvertor(options);
      const result = await convertor.convert(
        resolve(testDir, entry.action),
        await readFile(resolve(testDir, entry.metadata as string), 'utf-8'),
      );

      const received = await toReceivedObject(result);
      const expected = await loadExpectedObject(entry.result);

      expect(received).toEqual(expected);
    });
  }
});

async function toReceivedObject(
  result: CsvwTablesStream,
): Promise<SimpleTestTables> {
  const tables = {} as SimpleTestTables;

  for (const [tableName, [columns, stream]] of Object.entries(result)) {
    const table = [] as SimpleTestRow[];

    for await (const bindings of stream as any) {
      const row = {} as SimpleTestRow;

      for (const [key, value] of bindings) {
        const columnTitle = (
          columns.find(
            (column) => column.queryVariable === key.value,
          ) as CsvwColumn
        ).title;
        row[columnTitle] = value.value;
      }

      table.push(row);
    }

    tables[tableName] = table;
  }

  return tables;
}

async function loadExpectedObject(
  expectedTables: string[],
): Promise<SimpleTestTables> {
  const tables = {} as SimpleTestTables;

  for (const tableName of expectedTables) {
    const table = [] as SimpleTestRow[];

    const csv = parse(await readFile(resolve(testDir, tableName), 'utf-8'), {
      columns: true,
      trim: true,
    });

    for await (const line of csv) {
      const row = {} as SimpleTestRow;

      for (const columnTitle of Object.keys(line)) {
        row[columnTitle] = line[columnTitle];
      }

      table.push(row);
    }

    tables[tableName.substring(4)] = table;
  }

  return tables;
}

async function loadJsonLd(path: string, base: string): Promise<string> {
  const url =
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  if (!isAbsolute(url) && URL.canParse(url)) {
    if (url.startsWith('file:')) {
      return readFile(fileURLToPath(url), 'utf-8');
    }
    return defaultResolveJsonldFn(url, base);
  }

  return await readFile(url, 'utf-8');
}

function loadStringStream(
  path: string,
  base: string,
): Promise<ReadableStream<string>> {
  let url = URL.parse(path, base)?.href ?? resolve(base, path);
  if (url.startsWith(TEST_HTTP_BASE)) {
    url = url.replace(TEST_HTTP_BASE, testDir + '/');
  }
  url = url.replace(/[?#].*/g, '');
  return Promise.resolve(
    Readable.toWeb(createReadStream(url, 'utf-8')) as ReadableStream<string>,
  );
}
