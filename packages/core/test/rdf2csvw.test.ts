import { SimpleTest, SimpleTestType } from './types/manifest.js';
import {
  CsvwRow,
  CsvwTable,
  defaultResolveJsonldFn,
  ParseOptions,
  parseRdf,
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

const csvwDir = resolve(fileURLToPath(import.meta.url), '../../../../csvw');

describe('RDF -> CSVW with descriptor', () => {
  const testDir = resolve(fileURLToPath(import.meta.url), '../rdf2csvwtests');
  const tests = JSON.parse(
    readFileSync(resolve(testDir, 'manifest.json'), 'utf-8'),
  ) as SimpleTest[];

  for (const entry of tests) {
    runTest(testDir, entry);
  }
});

describe('NKOD: RDF -> CSVW with descriptor', () => {
  const testDir = resolve(fileURLToPath(import.meta.url), '../nkod');
  const tests = JSON.parse(
    readFileSync(resolve(testDir, 'manifest-nkod.json'), 'utf-8'),
  ) as SimpleTest[];

  for (const entry of tests) {
    runTest(testDir, entry);
  }
});

function runTest(testDir: string, entry: SimpleTest) {
  test(`#${entry.id}: ${entry.name}`, async () => {
    const convertorOptions: Rdf2CsvOptions = {
      baseIri: resolve(testDir, entry.action, '..'),
      pathOverrides: [
        [
          'http://www.w3.org/ns/csvw',
          pathToFileURL(resolve(csvwDir, 'ns/csvw.jsonld')).href,
        ],
      ],
      descriptor: JSON.parse(
        await readFile(resolve(testDir, entry.metadata as string), 'utf-8'),
      ),
      resolveJsonldFn: loadJsonLd,
    };

    const parseOptions: ParseOptions = {
      resolveStreamFn: loadStringStream,
    };

    const convertor = new Rdf2CsvwConvertor(convertorOptions);
    convertor.issueTracker.options.collectIssues = true;

    switch (entry.type) {
      case SimpleTestType.Test:
      case SimpleTestType.TestWithWarnings: {
        const result = await convertor.convert(
          await parseRdf(resolve(testDir, entry.action), parseOptions),
        );

        const received = await toReceivedObject(result);
        const expected = await loadExpectedObject(testDir, entry.result);

        expect(received).toEqual(expected);
        if (entry.type === SimpleTestType.TestWithWarnings) {
          expect(convertor.issueTracker.getWarnings()).not.toHaveLength(0);
        } else {
          expect(convertor.issueTracker.getWarnings()).toEqual([]);
        }
        break;
      }

      case SimpleTestType.NegativeTest: {
        await expect(async () => {
          await convertor.convert(
            await parseRdf(resolve(testDir, entry.action), parseOptions),
          );
        }).rejects.toThrow();
        break;
      }

      default:
        throw new Error('Unknown entry type.');
    }
  });
}

async function toReceivedObject(result: Readable): Promise<SimpleTestTables> {
  const tables = {} as SimpleTestTables;

  let table: CsvwTable;
  let row: CsvwRow;
  for await ([, table, row] of result) {
    if (tables[table.name] === undefined) {
      tables[table.name] = [];
    }

    tables[table.name].push(row);
  }

  for (const tableName of Object.keys(tables)) {
    // row order is arbitrary
    tables[tableName] = tables[tableName].sort(simpleTestRowCompareFn);
  }

  return tables;
}

async function loadExpectedObject(
  testDir: string,
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

    // row order is arbitrary
    // trim the test id from path
    const split = tableName.split('/');
    split.shift();
    tables[split.join('/')] = table.sort(simpleTestRowCompareFn);
  }

  return tables;
}

function simpleTestRowCompareFn(a: SimpleTestRow, b: SimpleTestRow): number {
  const keys: Set<string> = new Set();
  for (const key of Object.keys(a)) keys.add(key);
  for (const key of Object.keys(b)) keys.add(key);

  for (const key of [...keys].sort()) {
    const first = a[key] ?? '';
    const second = b[key] ?? '';
    if (first < second) return -1;
    else if (first > second) return 1;
  }
  return 0;
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
  let url = resolve(base, path);
  url = url.replace(/[?#].*/g, '');
  return Promise.resolve(
    Readable.toWeb(createReadStream(url, 'utf-8')) as ReadableStream<string>,
  );
}
