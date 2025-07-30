import { SimpleTest } from './types/manifest.js';
import {
  CsvwColumn,
  CsvwTablesStream,
  defaultResolveJsonldFn,
  Rdf2CsvOptions,
  Rdf2CsvwConvertor,
} from '../src/index.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pathToTests = join(__dirname, '/rdf2csvwtests');
const TEST_HTTP_BASE = 'http://example.com/';
const testDir = resolve(
  fileURLToPath(import.meta.url),
  '../../../../csvw/tests/',
);
type SimpleTestRow = Record<string, string>;
type SimpleTestTables = Record<string, SimpleTestRow[]>;

let tests: SimpleTest[] = [];

const options: Rdf2CsvOptions = {
  pathOverrides: [
    [
      'http://www.w3.org/ns/csvw',
      pathToFileURL(resolve(pathToTests, '../../../../csvw/ns/csvw.jsonld'))
        .href,
    ],
  ],
  resolveJsonldFn: loadJsonLd,
  resolveRdfStreamFn: loadStringStream,
};
const convertor: Rdf2CsvwConvertor = new Rdf2CsvwConvertor(options);
const testDataJson = readFileSync(join(pathToTests, 'testData.json'), 'utf-8');
tests = JSON.parse(testDataJson) as SimpleTest[];
const testFolders = getFolderNames(pathToTests);
for (let i = 0; i < testFolders.length; i++) {
  const inputDescriptor = readFileSync(
    join(pathToTests, testFolders[i], 'descriptor.json'),
    'utf-8',
  );
  const inputDataPath = join(pathToTests, testFolders[i], 'input.ttl');
  const expectedOutput = {
    'result.csv': readFileSync(
      join(pathToTests, testFolders[i], 'result.csv'),
      'utf-8',
    ),
  };
  tests[i] = {
    id: tests[i].id,
    name: tests[i].name,
    inputDataPath,
    expectedOutput,
    inputDescriptor,
    expectsError: tests[i].expectsError || false,
    expectsWarning: tests[i].expectsWarning || false,
  };
}

describe('rdf2csvw', () => {
  tests.forEach((test) => {
    it(test.name, async () => {
      const expectedTable = fillExpectedTable(test.expectedOutput);
      const result = await convertor.convert(
        test.inputDataPath,
        test.inputDescriptor,
      );
      const resultTable = await fillResultTable(result);
      expect(resultTable).toEqual(expectedTable);
    });
  });
});

function getFolderNames(dirPath: string): string[] {
  return readdirSync(dirPath).filter((name) =>
    statSync(join(dirPath, name)).isDirectory(),
  );
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
  console.log(url);
  if (url.startsWith(TEST_HTTP_BASE)) {
    url = url.replace(TEST_HTTP_BASE, testDir + '/');
  }
  url = url.replace(/[?#].*/g, '');
  console.log(url);
  return Promise.resolve(
    Readable.toWeb(createReadStream(url, 'utf-8')) as ReadableStream<string>,
  );
}

function fillExpectedTable(expectedOutput: {
  [tableName: string]: string;
}): SimpleTestTables {
  const tables = {} as SimpleTestTables;

  for (const tableName of Object.keys(expectedOutput)) {
    const table = [] as SimpleTestRow[];

    const lines = expectedOutput[tableName].split(/\r?\n/);
    const header = lines[0].split(',');

    for (let i = 1; i < lines.length; ++i) {
      const row = {} as SimpleTestRow;

      if (lines[i].trim()) {
        const values = lines[i].split(',');
        for (let j = 0; j < header.length && j < values.length; ++j)
          row[header[j]] = values[j];
        table.push(row);
      }
    }

    tables[tableName] = table;
  }

  return tables;
}

async function fillResultTable(
  result: CsvwTablesStream,
): Promise<SimpleTestTables> {
  const tables: SimpleTestTables = {};
  for (const [tableName, [columns, stream]] of Object.entries(result)) {
    tables[tableName] = [];
    for await (const bindings of stream) {
      tables[tableName].push({});
      for (const [key, value] of bindings) {
        console.log(key, value);
        const columnTitle = (
          columns.find(
            (column) => column.queryVariable === key.value,
          ) as CsvwColumn
        ).title;
        tables[tableName][tables[tableName].length - 1][columnTitle] =
          value.value;
      }
    }
  }
  console.log(tables);
  return tables;
}
