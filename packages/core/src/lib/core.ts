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
import { BlankNode, NamedNode } from 'n3';
import { RemoteDocument } from 'jsonld/jsonld-spec.js';

export async function normalizeDescriptor(
  descriptor: string | AnyCsvwDescriptor,
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
  const [internal, idMap] = await splitExternalProps(compactedExpanded);

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
    templateIRIs: options.templateIRIs ?? false,
    minimal: options.minimal ?? false,
  };
}

let externalSubjCounter = 0;
async function splitExternalProps(
  object: any,
  quadMap: Map<string, Quad[]> = new Map()
): Promise<[any, Map<string, Quad[]>]> {
  if (typeof object !== 'object' || object === null) {
    return [object, quadMap];
  }
  if (Array.isArray(object)) {
    const result = [];
    for (const item of object) {
      result.push((await splitExternalProps(item, quadMap))[0]);
    }
    return [result, quadMap];
  }
  const internal: NodeObject = {};
  const external: NodeObject = {};

  for (const key in object) {
    if (key.startsWith(csvwNs + '#')) {
      if (key === csvwNs + '#notes') {
        for (const note of object[key]) {
          for (const noteKey in note) {
            external[noteKey] = note[noteKey];
          }
        }
      } else {
        internal[key] = (await splitExternalProps(object[key], quadMap))[0];
      }
    } else if (key.startsWith('@')) {
      internal[key] = (await splitExternalProps(object[key], quadMap))[0];
      external[key] = object[key];
    } else {
      external[key] = object[key];
    }
  }

  if (!('@list' in internal || '@value' in internal || '@set' in internal)) {
    const externalId = `https://github.com/S0ft1/CSSW-RDF-convertor/externalsubj/${externalSubjCounter++}`;
    internal[csvwNs + '#notes'] = externalId;
    external['@id'] = externalId;
    quadMap.set(externalId, (await jsonld.toRDF(external)) as Quad[]);
  }
  return [internal, quadMap];
}

/** Class for manipulating the descriptor */
export class DescriptorWrapper {
  public get isTableGroup(): boolean {
    return this._isTableGroup(this.descriptor);
  }

  constructor(
    public descriptor: CompactedCsvwDescriptor,
    private externalProps: Map<string, Quad[]>
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
    sourceId: string,
    newSubj: NamedNode | BlankNode,
    store: Quadstore
  ) {
    const quads = this.externalProps.get(sourceId) as Quad[];
    for (const quad of quads) {
      if (quad.subject.value === sourceId) {
        quad.subject = newSubj;
      }
      await store.put(quad);
    }
  }
}
