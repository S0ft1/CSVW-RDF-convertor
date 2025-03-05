import { Manifest, EntryType } from './types/manifest';
import { CSVW2RDFConvertor } from '../src/lib/csvw2rdf-convertor.js';
import { Csvw2RdfOptions } from '../src/lib/conversion-options.js';
import { normalizeDescriptor } from '../src/lib/core.js';
import { defaultResolveFn } from '../src/lib/req-resolve.js';

import { createReadStream, existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { Quadstore } from 'quadstore';
import { MemoryLevel } from 'memory-level';
import { DataFactory, StreamParser } from 'n3';
import 'jest-rdf';

const testDir = '../../csvw/tests/';

const manifest = JSON.parse(
  readFileSync(testDir + 'manifest-rdf.jsonld', 'utf-8')
) as Manifest;

describe('CSVW -> RDF Official tests', () => {
  manifest.entries.slice(0, 1).forEach((entry) => {
    // TODO: take noProv and minimal entry options into account
    test(entry.name, async () => {
      try {
        const actualBackend = new MemoryLevel() as any;
        const actualStore = new Quadstore({
          backend: actualBackend,
          dataFactory: DataFactory as any,
        });
        const expectedBackend = new MemoryLevel() as any;
        const expectedStore = new Quadstore({
          backend: expectedBackend,
          dataFactory: DataFactory as any,
        });

        // TODO: Is path overriding correct?
        const options: Csvw2RdfOptions = {
          resolveJsonldFn: async (url: string, base: string) => {
            if (url == 'http://www.w3.org/ns/csvw') {
              return await readFile('../../csvw/ns/csvw.jsonld', 'utf-8');
            } else {
              return defaultResolveFn(url, base);
            }
          },
        };
        /*const options: Csvw2RdfOptions = { pathOverrides: [['http://www.w3.org/ns/csvw', '../../csvw/ns/csvw.jsonld']] };*/
        const descriptor = await readFile(
          resolveMetadataLocation(
            entry.action,
            entry?.option?.metadata,
            entry?.httpLink
          ),
          'utf-8'
        ).then((metadata) =>
          normalizeDescriptor(metadata, actualStore, options)
        );
        const convertor: CSVW2RDFConvertor = new CSVW2RDFConvertor(options);

        switch (entry.type) {
          // TODO: check warnings
          case EntryType.Test:
          case EntryType.TestWithWarnings: {
            await loadRDF(testDir + entry.result, expectedStore);
            expect(convertor.convert(descriptor)).resolves.not.toThrow();
            // TODO: should I open and close the store here?
            await actualStore.open();
            await expectedStore.open();
            expect((await actualStore.get({})).items).toBeRdfIsomorphic(
              (await expectedStore.get({})).items
            );
            await expectedStore.close();
            await actualStore.close();
            break;
          }

          case EntryType.NegativeTest:
            expect(convertor.convert(descriptor)).rejects.toThrow();
            break;

          default:
            throw new Error('Unknown entry type.');
        }
      } catch (err) {
        err.message = `${err.message}\nTest comment: ${entry.comment}`;
        throw err;
      }
    });
  });
});

function resolveMetadataLocation(
  actionPath: string,
  metadataPath?: string,
  httpLink?: string
): string {
  // remove the query part from url
  const action = actionPath.replace(/(?<=\.csv|\.json)[?#].*/, '');
  let resolvedMetadataPath: string;

  // metadata supplied by the user of the implementation that is processing the tabular data.
  if (metadataPath) return testDir + metadataPath;

  // metadata in a document linked to using a Link header associated with the tabular data file.
  resolvedMetadataPath = testDir + httpLink?.match(/<[^<>]*>/);
  if (httpLink && existsSync(resolvedMetadataPath)) return resolvedMetadataPath;

  // metadata located through default paths which may be overridden by a site-wide location configuration.
  //     TODO: .csv -> .json replacement is not found in the csvw standard
  resolvedMetadataPath = testDir + action.replace(/\.csv/, '.json');
  if (existsSync(resolvedMetadataPath)) return resolvedMetadataPath;
  //     {+url}-metadata.json
  resolvedMetadataPath = testDir + action + '-metadata.json';
  if (existsSync(resolvedMetadataPath)) return resolvedMetadataPath;
  //     csv-metadata.json
  resolvedMetadataPath =
    testDir + action.replace(/[^/]*\.csv$/, 'csv-metadata.json');
  if (existsSync(resolvedMetadataPath)) return resolvedMetadataPath;

  throw new Error('Metadata file location could not be resolved.');
}

async function loadRDF(rdfFilePath: string, store: Quadstore) {
  await store.open();
  const reader = createReadStream(rdfFilePath);
  const parser = new StreamParser({ format: 'text/turtle' });
  await store.putStream(reader.pipe(parser), { batchSize: 100 });
}
