import { Manifest, EntryType, Entry } from './types/manifest.js';
import { CSVW2RDFConvertor } from '../src/lib/csvw2rdf-convertor.js';
import { Csvw2RdfOptions } from '../src/lib/conversion-options.js';
import { defaultResolveJsonldFn } from '../src/lib/req-resolve.js';
import { numericTypes } from '../src/lib/utils/prefix.js';

import { createReadStream, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import { Quad } from 'quadstore';
import { DataFactory, StreamParser } from 'n3';
import { Stream } from '@rdfjs/types';
const { literal, quad } = DataFactory;

// these need to be here for vscode to find the types
import fetchMock from 'jest-fetch-mock';
import 'jest-rdf';
import { Readable } from 'node:stream';

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

  // skip: 34,65-72 (#149, #263-#304)

  for (const entry of manifest.entries
    .filter((e) => e.type === EntryType.Test)
    .filter((_, i) => i != 34 && (i < 65 || i > 72))) {
    test(entry.name, async () => {
      const options: Csvw2RdfOptions = {
        pathOverrides: [
          ['http://www.w3.org/ns/csvw', resolve(testDir, '../ns/csvw.jsonld')],
        ],
        resolveJsonldFn: loadJsonLd,
        resolveCsvStreamFn: loadStringStream,
      };

      switch (entry.type) {
        // TODO: check warnings
        case EntryType.Test:
        case EntryType.TestWithWarnings: {
          const expected = await loadRDF(
            resolve(testDir, entry.result as string)
          );
          const actual = await rdfStreamToArray(
            await runConversion(options, entry)
          );
          expect(actual).toBeRdfIsomorphic(expected);
          break;
        }

        case EntryType.NegativeTest:
          await expect(runConversion(options, entry)).rejects.toThrow();
          break;

        default:
          throw new Error('Unknown entry type.');
      }
    });
  }
});

async function runConversion(options: Csvw2RdfOptions, entry: Entry) {
  const fromCsvUrl = !!entry.action.match(/\.csv([?#].*)?/);
  const convertor = new CSVW2RDFConvertor({
    ...options,
    minimal: entry.option.minimal,
    baseIRI: fromCsvUrl ? TEST_HTTP_BASE : resolve(testDir, entry.action, '..'),
  });

  if (fromCsvUrl && !entry.option.metadata) {
    setupImplicit(entry);
    return convertor.convertFromCsvUrl(entry.action);
  }
  const descriptor = await readFile(
    resolve(testDir, entry.option.metadata ?? entry.action),
    'utf-8'
  );
  return convertor.convert(descriptor, entry.option.metadata ?? entry.action);
}

async function loadJsonLd(path: string, base: string): Promise<string> {
  const url = URL.parse(path, base)?.href ?? resolve(base, path);
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
      return quad(
        q.subject,
        q.predicate,
        literal(numeric + '', q.object.datatype)
      );
    }
    return q;
  });
}

function rdfStreamToArray(stream: Stream<Quad>) {
  const quads: Quad[] = [];
  return new Promise<Quad[]>((resolve, reject) => {
    stream.on('data', (quad: Quad) => {
      quads.push(quad);
    });
    stream.on('end', () => {
      resolve(quads);
    });
    stream.on('error', (error) => {
      reject(error);
    });
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
