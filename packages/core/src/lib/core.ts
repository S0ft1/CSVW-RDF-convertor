import jsonld, { NodeObject } from 'jsonld';
import {
  CompactedCsvwDescriptor,
  CompactedExpandedCsvwDescriptor,
} from './types/descriptor/descriptor.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
import { csvwNs } from './types/descriptor/namespace.js';
import { Csvw2RdfOptions } from './conversion-options.js';
import { replaceUrl } from './utils/replace-url.js';
import { Quad, Quadstore } from 'quadstore';
import { BlankNode, NamedNode } from 'n3';
import { JsonLdArray, RemoteDocument } from 'jsonld/jsonld-spec.js';
import { validate as bcp47Validate } from 'bcp47-validate';

/**
 * Normalize the JSON-LD descriptor to a specific format.
 * @param descriptor descriptor either as parsed or stringified JSON
 * @param options options for the conversion
 * @returns wrapper containing the normalized descriptor
 */
export async function normalizeDescriptor(
  descriptor: string | AnyCsvwDescriptor,
  options: Required<Csvw2RdfOptions>,
  url?: string
): Promise<DescriptorWrapper> {
  const docLoader = async (url: string) => {
    url = replaceUrl(url, options.pathOverrides);
    return {
      document: JSON.parse(await options.resolveJsonldFn(url, options.baseIRI)),
      documentUrl: url,
    };
  };
  const csvw = await docLoader(csvwNs);
  console.log('csvw', csvw);

  let parsedDescriptor: AnyCsvwDescriptor;
  if (typeof descriptor === 'string') {
    parsedDescriptor = JSON.parse(descriptor);
  } else {
    parsedDescriptor = descriptor;
  }
  if (
    parsedDescriptor['@id'] &&
    typeof parsedDescriptor['@id'] !== 'string' &&
    url
  ) {
    parsedDescriptor['@id'] = url;
  }
  removeInvalidIds(parsedDescriptor);
  validateLanguage(parsedDescriptor as NodeObject);
  const originalCtx = parsedDescriptor['@context'];

  const expanded = await jsonld.expand(
    parsedDescriptor as jsonld.JsonLdDocument,
    { documentLoader: docLoader }
  );
  await loadReferencedSubdescriptors(expanded, docLoader, options, originalCtx);
  const compactedExpanded = (await jsonld.compact(
    expanded,
    {},
    { documentLoader: docLoader }
  )) as CompactedExpandedCsvwDescriptor;
  const [internal, idMap]: [CompactedCsvwDescriptor, Map<string, Quad[]>] =
    await splitExternalProps(compactedExpanded);

  return new DescriptorWrapper(
    (await compactCsvwNs(
      internal,
      docLoader
    )) as unknown as CompactedCsvwDescriptor,
    idMap
  );
}

/**
 * Removes `@id` properties which are not strings from the descriptor.
 * This is needed because the JSON-LD parser throws errors but we want to ignore them.
 * @param obj descriptor as parsed expanded JSON-LD
 */
function removeInvalidIds(obj: Record<string, any>) {
  for (const key in obj) {
    if (key === '@id') {
      if (typeof obj[key] !== 'string') {
        obj[key] = '';
      }
    } else if (typeof obj[key] === 'object') {
      removeInvalidIds(obj[key]);
    }
  }
}

/**
 * Validates the language tags in the descriptor and removes invalid ones.
 * @param obj descriptor as parsed expanded JSON-LD
 */
function validateLanguage(obj: NodeObject) {
  const ctx = Array.isArray(obj['@context'])
    ? obj['@context']
    : [obj['@context']];
  for (const c of ctx) {
    if (typeof c === 'object' && c?.['@language']) {
      if (!bcp47Validate(c['@language'])) {
        delete c['@language'];
      }
    }
  }
}

/**
 * The descriptor can include references to other descriptors.
 * This function loads these referenced descriptors and replaces the references in the original descriptor.
 * @param descriptor descriptor as parsed expanded JSON-LD
 */
async function loadReferencedSubdescriptors(
  descriptor: JsonLdArray,
  docLoader: (url: string) => Promise<{
    document: any;
    documentUrl: string;
  }>,
  options: Required<Csvw2RdfOptions>,
  originalCtx: AnyCsvwDescriptor['@context']
) {
  const root = descriptor[0];
  const objects = [root];
  if (csvwNs + '#table' in root) {
    objects.push(...(root[csvwNs + '#table'] as JsonLdArray));
  }

  for (const object of objects) {
    for (const key of ['#tableSchema', '#dialect']) {
      if (csvwNs + key in object) {
        const refContainer = (object[csvwNs + key] as JsonLdArray)[0];
        if ('@id' in refContainer && Object.keys(refContainer).length === 1) {
          // is a reference
          const doc = await options.resolveJsonldFn(
            replaceUrl(refContainer['@id'] as string, options.pathOverrides),
            options.baseIRI
          );
          const parsed = JSON.parse(doc);
          if (parsed['@id'] && typeof parsed['@id'] !== 'string') {
            parsed['@id'] = refContainer['@id'];
          }
          removeInvalidIds(parsed);
          validateLanguage(parsed as NodeObject);
          const subdescriptor = await jsonld.expand(
            { '@context': originalCtx as any, [csvwNs + key]: parsed },
            { documentLoader: docLoader }
          );
          object[csvwNs + key] = subdescriptor[0][csvwNs + key];
        }
      }
    }
  }
}

/**
 * Compacts the descriptor to remove the `csvw:` prefix from the properties.
 * @param descriptor descriptor as parsed JSON
 * @param docLoader loader function for the `jsonld` library
 */
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

/**
 * Removes the `csvw:` prefix from properties of `descriptor` recursively in place.
 * @param descriptor any object to be shortened
 */
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

let externalSubjCounter = 0;
/**
 * removes non-csvw properties and csvw:notes from `object` and stores them in `quadMap` as RDF quads with temporary subject.
 * The temporary subject id is stored in the csvw:notes property of the object.
 * @param object object to be split
 * @param quadMap map to store the RDF quads with temporary subject
 * @returns the object without non-csvw properties and the map of RDF quads
 */
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
      if (key === csvwNs + '#note') {
        for (const note of Array.isArray(object[key])
          ? object[key]
          : [object[key]]) {
          external[csvwNs + '#note'] = note;
        }
      } else {
        internal[key] = (await splitExternalProps(object[key], quadMap))[0];
      }
    } else if (key.startsWith('@')) {
      internal[key] = (await splitExternalProps(object[key], quadMap))[0];
      if (key !== '@id') {
        external[key] = object[key];
      }
    } else {
      external[key] = object[key];
    }
  }

  if (
    !('@list' in internal || '@value' in internal || '@set' in internal) &&
    Object.keys(external).length
  ) {
    const externalId = `https://github.com/S0ft1/CSSW-RDF-convertor/externalsubj/${externalSubjCounter++}`;
    internal[csvwNs + '#note'] = externalId;
    external['@id'] = externalId;
    quadMap.set(externalId, (await jsonld.toRDF(external)) as Quad[]);
  }
  return [internal, quadMap];
}

/** Class for manipulating the descriptor */
export class DescriptorWrapper {
  /** does the descriptor describe table group or table? */
  public get isTableGroup(): boolean {
    return this._isTableGroup(this.descriptor);
  }

  constructor(
    public descriptor: CompactedCsvwDescriptor,
    /** extra non-csvw properties from the original descriptor */
    private externalProps: Map<string, Quad[]>
  ) {}

  private _isTableGroup(
    x: CompactedCsvwDescriptor
  ): x is CsvwTableGroupDescription {
    return 'tables' in x;
  }

  /** iterator over referenced tables */
  public *getTables() {
    if (this._isTableGroup(this.descriptor)) {
      for (const element of this.descriptor.tables) {
        yield element;
      }
    } else {
      yield this.descriptor;
    }
  }

  /**
   * The CSVW descriptor can include extra non-csvw properties at various levels. The inner descriptor
   * does not include these properties, but they are stored separately as RDF quads with temporary subject.
   * The descriptor contains reference to this subject in a `notes` property.
   * This function retrieves these properties and inserts them into the RDF graph with a proper subject.
   * @param sourceId temporary subject id for the external properties
   * @param newSubj subject for the external properties
   * @param store store to insert the external properties into
   */
  public async setupExternalProps(
    sourceId: string,
    newSubj: NamedNode | BlankNode,
    store: Quadstore
  ) {
    const quads = this.externalProps.get(sourceId) as Quad[];
    if (!quads) return;
    for (const quad of quads) {
      if (quad.subject.value === sourceId) {
        quad.subject = newSubj;
      }
      await store.put(quad);
    }
  }
}
