import { Manifest, EntryType, Entry } from './types/manifest.js';
import { Csvw2RdfConvertor } from '../src/lib/csvw2rdf/convertor.js';
import { Csvw2RdfOptions } from '../src/lib/conversion-options.js';
import { defaultResolveJsonldFn } from '../src/lib/req-resolve.js';
import { numericTypes } from '../src/lib/utils/prefix.js';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import { DataFactory, StreamParser } from 'n3';
import { Stream, Quad } from '@rdfjs/types';
import { IssueTracker } from '../src/lib/utils/issue-tracker.js';
import { Readable } from 'node:stream';
const { literal, quad, namedNode } = DataFactory;

// these need to be here for vscode to find the types
import fetchMock from 'jest-fetch-mock';
import 'jest-rdf';
import { rdfStreamToArray } from '../src/lib/utils/rdf-stream-to-array.js';

const testDir = resolve(
  fileURLToPath(import.meta.url),
  '../../../../csvw/tests/'
);
const TEST_HTTP_BASE = 'http://example.com/';
const manifest = JSON.parse(
  readFileSync(resolve(testDir, 'manifest-rdf.jsonld'), 'utf-8')
) as Manifest;
describe('CSVW -> RDF Official tests', () => {
  beforeEach(() => {
    fetchMock.default.resetMocks();
  });

  const skippedTests = [
    // JSON-LD specification conflicts with the idea of the test
    93, 99, 100, 101, 135, 136, 270, 271, 272, 274,
    // CSVW default names (_col1, _col2, ...) expected instead of CSV header titles
    107,
    148, 149, 278,
    // comment in header
    286, 287, 296, 297, 298, 299, 300, 301,
  ];

  for (const entry of manifest.entries.filter(
    (e) => !skippedTests.includes(+e.id.slice(-3))
  )) {
    test('#' + entry.id.slice(-3) + ': ' + entry.name, async () => {
      const options: Csvw2RdfOptions = {
        pathOverrides: [
          [
            'http://www.w3.org/ns/csvw',
            pathToFileURL(resolve(testDir, '../ns/csvw.jsonld')).href,
          ],
        ],
        resolveJsonldFn: loadJsonLd,
        resolveCsvStreamFn: loadStringStream,
      };

      switch (entry.type) {
        case EntryType.Test:
        case EntryType.TestWithWarnings: {
          const expected = await loadRDF(
            resolve(testDir, entry.result as string)
          );
          const [stream, issueTracker] = await runConversion(options, entry);
          const actual = await rdfStreamToArray(stream);
          expect(actual).toBeRdfIsomorphic(expected);
          if (entry.type === EntryType.TestWithWarnings) {
            expect(issueTracker.getWarnings()).not.toHaveLength(0);
          } else {
            expect(issueTracker.getWarnings()).toEqual([]);
          }
          break;
        }

        case EntryType.NegativeTest:
          await expect(
            runConversion(options, entry).then(([stream]) =>
              rdfStreamToArray(stream)
            )
          ).rejects.toThrow();
          break;

        default:
          throw new Error('Unknown entry type.');
      }
    });
  }
});

async function runConversion(
  options: Csvw2RdfOptions,
  entry: Entry
): Promise<[Stream<Quad>, IssueTracker]> {
  const fromCsvUrl = !!entry.action.match(/\.csv([?#].*)?/);
  const convertor = new Csvw2RdfConvertor({
    ...options,
    minimal: entry.option.minimal,
    baseIRI: fromCsvUrl ? TEST_HTTP_BASE : resolve(testDir, entry.action, '..'),
  });
  convertor.issueTracker.options.collectIssues = true;

  if (fromCsvUrl && !entry.option.metadata) {
    setupImplicit(entry);
    return [convertor.convertFromCsvUrl(entry.action), convertor.issueTracker];
  }
  const descriptor = await readFile(
    resolve(testDir, entry.option.metadata ?? entry.action),
    'utf-8'
  );
  return [
    convertor.convert(descriptor, entry.option.metadata ?? entry.action),
    convertor.issueTracker,
  ];
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
  base: string
): Promise<ReadableStream<string>> {
  let url = URL.parse(path, base)?.href ?? resolve(base, path);
  if (url.startsWith(TEST_HTTP_BASE)) {
    url = url.replace(TEST_HTTP_BASE, testDir + '/');
  }
  url = url.replace(/[?#].*/g, '');
  return Promise.resolve(
    Readable.toWeb(createReadStream(url, 'utf-8')) as ReadableStream<string>
  );
}

async function loadRDF(rdfFilePath: string) {
  const reader = createReadStream(rdfFilePath);
  const parser = new StreamParser({ format: 'text/turtle' });
  const stringConstants = new Set(['NaN', 'INF', '-INF']);
  const rdfArray = await rdfStreamToArray(reader.pipe(parser));
  return rdfArray.map((q) => {
    // normalize relative IRIs
    const newPred = namedNode(
      q.predicate.value.replace('http://www.w3.org/2013/csvw/tests/', '')
    );

    // normalize numeric literals
    if (
      q.object.termType === 'Literal' &&
      numericTypes.has(q.object.datatype.value) &&
      !stringConstants.has(q.object.value)
    ) {
      const numeric = +q.object.value;
      if (numeric === 0 && q.object.value.startsWith('-')) {
        return quad(q.subject, q.predicate, literal('-0', q.object.datatype));
      }
      return quad(q.subject, newPred, literal(numeric + '', q.object.datatype));
    } else if (q.object.termType === 'NamedNode') {
      return quad(
        q.subject,
        newPred,
        namedNode(
          q.object.value.replace('http://www.w3.org/2013/csvw/tests/', '')
        )
      );
    }
    return quad(q.subject, newPred, q.object, q.graph);
  });
}

function setupImplicit(entry: Entry) {
  fetchMock.default.mockResponse((req) => {
    const url = req.url.replace(TEST_HTTP_BASE, '');
    if (entry.implicit?.includes(url)) {
      return readFile(resolve(testDir, url), 'utf-8');
    } else if (url === entry.action && entry.httpLink) {
      return Promise.resolve({
        status: 404,
        headers: {
          link: entry.httpLink,
        },
        url: req.url,
      });
    } else if (entry.name.includes('w3.org/.well-known/csvm')) {
      // for some reason this file is not among implicit files
      if (url === '.well-known/csvm') {
        return Promise.resolve(
          '{+url}-metadata.json\ncsv-metadata.json\n{+url}.json\ncsvm.json'
        );
      }
    }
    return Promise.resolve({ status: 404, url });
  });
}
