import { Manifest, EntryType, Entry } from './types/manifest';
import { CSVW2RDFConvertor } from '../src/lib/csvw2rdf-convertor.js';
import { Csvw2RdfOptions } from '../src/lib/conversion-options.js';
import { defaultResolveJsonldFn } from '../src/lib/req-resolve.js';

import { createReadStream, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import { Quad } from 'quadstore';
import { StreamParser } from 'n3';
import { Stream } from '@rdfjs/types';

// these need to be here for vscode to find the types
import fetchMock from 'jest-fetch-mock';
import 'jest-rdf';
import { Readable } from 'node:stream';

const testDir = '../../csvw/tests/';
const TEST_HTTP_BASE = 'http://example.com/';
const manifest = JSON.parse(
  readFileSync(testDir + 'manifest-rdf.jsonld', 'utf-8')
) as Manifest;

describe('CSVW -> RDF Official tests', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  for (const entry of manifest.entries.slice(25, 26)) {
    test(entry.name, async () => {
      const options: Csvw2RdfOptions = {
        pathOverrides: [
          [
            'http://www.w3.org/ns/csvw',
            pathToFileURL('../../csvw/ns/csvw.jsonld').href,
          ],
        ],
        resolveJsonldFn: loadJsonLd,
        resolveCsvStreamFn: loadStringStream,
      };

      switch (entry.type) {
        // TODO: check warnings
        case EntryType.Test:
        case EntryType.TestWithWarnings: {
          const expected = await loadRDF(testDir + entry.result);
          const actual = await rdfStreamToArray(
            await runConversion(options, entry)
          );
          expect(actual).toBeRdfIsomorphic(expected);
          break;
        }

        case EntryType.NegativeTest:
          expect(runConversion(options, entry)).rejects.toThrow();
          break;

        default:
          throw new Error('Unknown entry type.');
      }
    });
  }
});

async function runConversion(options: Csvw2RdfOptions, entry: Entry) {
  const fromCsvUrl = entry.action.endsWith('.csv');
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
    testDir + (entry.option.metadata ?? entry.action),
    'utf-8'
  );
  return convertor.convert(descriptor);
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
    url = url.replace(TEST_HTTP_BASE, testDir);
  }
  return Promise.resolve(
    Readable.toWeb(createReadStream(url, 'utf-8')) as ReadableStream<string>
  );
}

function loadRDF(rdfFilePath: string) {
  const reader = createReadStream(rdfFilePath);
  const parser = new StreamParser({ format: 'text/turtle' });
  return rdfStreamToArray(reader.pipe(parser));
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
  fetchMock.mockResponse((req) => {
    const url = req.url.replace(TEST_HTTP_BASE, '');
    if (entry.implicit?.includes(url)) {
      return readFile(testDir + url, 'utf-8');
    } else if (url === entry.action && entry.httpLink) {
      return Promise.resolve({
        status: 404,
        headers: {
          link: entry.httpLink,
        },
        url: req.url,
      });
    }
    return Promise.resolve({ status: 404, url });
  });
}
