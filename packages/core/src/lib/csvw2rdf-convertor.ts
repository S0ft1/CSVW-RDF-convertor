import { DescriptorWrapper } from './core.js';
import { Expanded } from './descriptor/expanded.js';
import { CsvwTableGroupDescription } from './descriptor/table-group.js';
import { CsvwTableDescription } from './descriptor/table.js';
import { RDFSerialization } from './types/rdf-serialization.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { DataFactory } from 'n3';
import { Csvw2RdfOptions } from './conversion-options.js';

export class CSVW2RDFConvertor {
  config?: unknown;
  pathOverrides?: Record<string, string>;
  offline?: boolean;

  public constructor(
    config?: unknown,
    pathOverrides?: Record<string, string>,
    offline?: boolean
  ) {
    this.config = config;
    this.pathOverrides = pathOverrides;
    this.offline = offline;
  }

  public async convert(
    input: DescriptorWrapper<Csvw2RdfOptions>,
  ) {
    const backend = new MemoryLevel() as any;
    const { namedNode, literal, defaultGraph, quad } = DataFactory;
    // different versions of RDF.js types in quadstore and n3
    const store = new Quadstore({backend, dataFactory: DataFactory as unknown as StoreOpts['dataFactory']});
    await store.open();
    await store.put(quad(
      namedNode('http://example.com/subject'),
      namedNode('http://example.com/predicate'),
      namedNode('http://example.com/object'),
      defaultGraph(),
    ));
    console.log("xd");
    const descr = input.getTables();
    //throw new Error('Not implemented.');
    
  }

  private getUri(prefix: string): Promise<string | null> {
    return (
      fetch(`https://prefix.cc/${prefix}.file.json`)
        .then((response) => response.json() as Promise<PrefixCCResponse>)
        .then((data) => data[prefix])
        // Prefix not found, or prefix.cc does not respond
        .catch(() => null)
    );
  }

  private getPrefix(uri: string): Promise<string | null> {
    return (
      fetch(`https://prefix.cc/reverse?uri=${uri}&format=json`)
        .then((response) => response.json() as Promise<PrefixCCResponse>)
        .then((data) => Object.keys(data)[0])
        // No registered prefix for the given URI, or prefix.cc does not respond
        .catch(() => null)
    );
  }
}

interface PrefixCCResponse {
  [key: string]: string;
}
