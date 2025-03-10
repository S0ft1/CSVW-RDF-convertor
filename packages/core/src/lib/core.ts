import jsonld, { NodeObject } from 'jsonld';
import {
  CompactedCsvwDescriptor,
  CompactedExpandedCsvwDescriptor,
} from './types/descriptor/descriptor.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
import { csvwNs } from './types/descriptor/namespace.js';
import { Csvw2RdfOptions } from './conversion-options.js';
import { defaultResolveFn, defaultResolveStreamFn } from './req-resolve.js';
import { replaceUrl } from './utils/replace-url.js';
import { Quad, Quadstore } from 'quadstore';
import { BlankNode, DataFactory, NamedNode } from 'n3';
import { RemoteDocument } from 'jsonld/jsonld-spec.js';

export async function normalizeDescriptor(
  descriptor: string | AnyCsvwDescriptor,
  store: Quadstore,
  options?: Csvw2RdfOptions
): Promise<DescriptorWrapper> {
  const completeOpts = setDefaults(options);
  const docLoader = async (url: string) => {
    url = replaceUrl(url, completeOpts.pathOverrides);
    return {
      document: JSON.parse(
        await completeOpts.resolveJsonldFn(url, completeOpts.baseIRI)
      ),
      documentUrl: url,
    };
  };

  let parsedDescriptor: AnyCsvwDescriptor;
  if (typeof descriptor === 'string') {
    parsedDescriptor = JSON.parse(descriptor);
  } else {
    parsedDescriptor = descriptor;
  }

  const expanded = await jsonld.expand(
    parsedDescriptor as jsonld.JsonLdDocument,
    { documentLoader: docLoader }
  );
  const compactedExpanded = (await jsonld.compact(
    expanded,
    {},
    { documentLoader: docLoader }
  )) as CompactedExpandedCsvwDescriptor;
  const [internal, idMap] = await splitExternalProps(compactedExpanded, store);

  return new DescriptorWrapper(
    (await compactCsvwNs(
      internal,
      docLoader
    )) as unknown as CompactedCsvwDescriptor,
    idMap
  );
}

async function compactCsvwNs(
  descriptor: any,
  docLoader: (url: string) => Promise<RemoteDocument>
) {
  const compacted = await jsonld.compact(descriptor, csvwNs as any, {
    documentLoader: docLoader,
  });
  shortenProps(compacted);
  return compacted;
}

function shortenProps(descriptor: any) {
  if (typeof descriptor !== 'object' || descriptor === null) return;
  if (Array.isArray(descriptor)) {
    for (const item of descriptor) {
      shortenProps(item);
    }
  }
  for (const key in descriptor) {
    if (key.startsWith('csvw:')) {
      descriptor[key.slice(5)] = descriptor[key];
      delete descriptor[key];
    } else {
      shortenProps(descriptor[key]);
    }
  }
}

function setDefaults(options?: Csvw2RdfOptions): Required<Csvw2RdfOptions> {
  options ??= {};
  return {
    pathOverrides: options.pathOverrides ?? [],
    offline: options.offline ?? false,
    resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveFn,
    resolveCsvStreamFn: options.resolveCsvStreamFn ?? defaultResolveStreamFn,
    baseIRI: options.baseIRI ?? '',
  };
}

let externalSubjCounter = 0;
async function splitExternalProps(
  object: any,
  store: Quadstore,
  idMap: Map<any, string> = new Map()
): Promise<[any, Map<any, string>]> {
  if (typeof object !== 'object' || object === null) {
    return [object, idMap];
  }
  if (Array.isArray(object)) {
    const result = [];
    for (const item of object) {
      result.push((await splitExternalProps(item, store, idMap))[0]);
    }
    return [result, idMap];
  }
  const internal: NodeObject = {};
  const external: NodeObject = {};

  for (const key in object) {
    if (key.startsWith(csvwNs + '#')) {
      internal[key] = (await splitExternalProps(object[key], store, idMap))[0];
    } else if (key.startsWith('@')) {
      internal[key] = (await splitExternalProps(object[key], store, idMap))[0];
      external[key] = object[key];
    } else {
      external[key] = object[key];
    }
  }

  if ('@value' in internal) return [internal, idMap];
  if ('@list' in internal) return [internal, idMap];
  const externalId = `_:extsubj${externalSubjCounter++}`;
  external['@id'] = externalId;
  idMap.set(internal, externalId);
  const rdf = (await jsonld.toRDF(external)) as Quad[];
  await store.multiPut(rdf);
  return [internal, idMap];
}

/** Class for manipulating the descriptor */
export class DescriptorWrapper {
  public get isTableGroup(): boolean {
    return this._isTableGroup(this.descriptor);
  }

  constructor(
    public descriptor: CompactedCsvwDescriptor,
    private externalPropsSubjs: Map<any, string>
  ) {}

  private _isTableGroup(
    x: CompactedCsvwDescriptor
  ): x is CsvwTableGroupDescription {
    return 'tables' in x;
  }

  public *getTables() {
    if (this._isTableGroup(this.descriptor)) {
      for (const element of this.descriptor.tables) {
        yield element;
      }
    } else {
      yield this.descriptor;
    }
  }

  public async setupExternalProps(
    source: Record<string, any>,
    newSubj: NamedNode | BlankNode,
    store: Quadstore
  ) {
    const sourceId = this.externalPropsSubjs.get(source);
    if (!sourceId) return;
    const quads = await store.get({ subject: DataFactory.namedNode(sourceId) });
    for (const quad of quads.items) {
      await store.put(
        DataFactory.quad(newSubj, quad.predicate, quad.object, quad.graph)
      );
    }
    await store.multiDel(quads.items);
  }
}
