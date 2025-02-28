import { readFileSync } from 'fs';
import { Manifest, Entry, EntryType } from './types/manifest';
import { CSVW2RDFConvertor } from '../src/lib/csvw2rdf-convertor.js';
import { normalizeDescriptor } from '../src/lib/core.js';
import { Quadstore, StoreOpts } from 'quadstore';
import { MemoryLevel } from 'memory-level';
import { DataFactory } from 'n3';

async function runTest(entry: Entry) {
    throw new Error("Not implemented.");
}

const manifest = JSON.parse(
    readFileSync('../../csvw/tests/manifest-rdf.jsonld', 'utf-8')
) as Manifest;

describe("CSVW -> RDF Official tests", () => {
    manifest.entries.forEach(entry => {
        test(entry.name, async () => {
            switch (entry.type) {
                case EntryType.Test:
                    expect(() => runTest(entry));
                    break;
                
                case EntryType.TestWithWarnings:
                    expect(() => runTest(entry));
                    break;
                
                case EntryType.NegativeTest:
                    expect(() => runTest(entry)).toThrow();
                    break;

                default:
                    throw new Error("Unknown entry type.")
            }
        });
    });
});
