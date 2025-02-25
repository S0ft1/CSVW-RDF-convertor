import { DescriptorWrapper } from './core.js';
import { Expanded } from './types/descriptor/expanded.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import { RDFSerialization } from './types/rdf-serialization.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { BlankNode, DataFactory, NamedNode, Quad } from 'n3';
import { Csvw2RdfOptions } from './conversion-options.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from './types/descriptor/datatype.js';
import { commonPrefixes } from './utils/prefix.js';
import { CsvwInheritedProperties } from './types/descriptor/inherited-properties.js';
import { CsvwColumnDescription } from './types/descriptor/column-description.js';
import jsonld, { NodeObject } from 'jsonld';

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

  public async convert(input: DescriptorWrapper) {
    const backend = new MemoryLevel() as any;
    const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
    // different versions of RDF.js types in quadstore and n3
    const store = new Quadstore({
      backend,
      dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
    });
    await store.open();

    /*await store.put(quad(
      namedNode('http://example.com/subject'),
      namedNode('http://example.com/predicate'),
      namedNode('http://example.com/object'),
      defaultGraph(),
    ));*/

    let groupNode: NamedNode | BlankNode;
    //1
    if (input.isTableGroup) {
      if (input.descriptor['@id'] === undefined) {
        groupNode = blankNode();
      } else {
        groupNode = namedNode(input.descriptor['@id']);
      }
    } else {
      groupNode = blankNode();
    }

    //2
    await store.put(
      quad(
        groupNode,
        namedNode('rdf:type'),
        namedNode('csvw:TableGroup'),
        defaultGraph()
      )
    );

    //3
    //TODO: implement the third rule, for this utility functions will be created

    //4
    for (const table of input.getTables()) {
      if (table['http://www.w3.org/ns/csvw#suppressOutput'] === false) {
        //4.1
        const tableNode = this.createNamedNodeByIdOrBlankNode(table);
        //4.2
        await store.put(
          quad(groupNode, namedNode('csvw:table'), tableNode, defaultGraph())
        );
        //4.3
        await store.put(
          quad(groupNode, namedNode('csvw:type'), tableNode, defaultGraph())
        );
      }
    }
    //throw new Error('Not implemented.');
    store.close();
  }

  private createNamedNodeByIdOrBlankNode(
    input: Expanded<CsvwTableGroupDescription> | Expanded<CsvwTableDescription>
  ): any {
    const { namedNode, blankNode } = DataFactory;
    if (input['@id'] === undefined) {
      return blankNode();
    } else {
      return namedNode(input['@id']);
    }
  }

  private async insertExternalTriples(
    store: Quadstore,
    descriptor: DescriptorWrapper,
    object: NodeObject
  ) {
    const tempDoc: NodeObject = {};
    for (const key in descriptor.getExternalProps(object)) {
      tempDoc[key] = object[key];
    }
    const rdf = (await jsonld.toRDF(tempDoc)) as Quad[];
    await store.multiPut(rdf);
  }

  private interpretDatatype(
    value: string,
    col: Expanded<CsvwColumnDescription>,
    table: Expanded<CsvwTableDescription>,
    tg: Expanded<CsvwTableGroupDescription>
  ) {
    const { literal } = DataFactory;
    const dtOrBuiltin = this.inherit(
      'http://www.w3.org/ns/csvw#datatype',
      col,
      table['http://www.w3.org/ns/csvw#tableSchema'],
      table,
      tg
    );
    if (!dtOrBuiltin) {
      throw new Error(`No datatype specified for ${this.debugCol(col, table)}`);
    }
    const dt =
      typeof dtOrBuiltin === 'string'
        ? { 'http://www.w3.org/ns/csvw#base': dtOrBuiltin }
        : dtOrBuiltin;
    let dtUri = dt['@id'];
    const lang = this.inherit(
      'http://www.w3.org/ns/csvw#lang',
      col,
      table['http://www.w3.org/ns/csvw#tableSchema'],
      table,
      tg
    );
    if (!dtUri) {
      if (!dt['http://www.w3.org/ns/csvw#base']) {
        throw new Error('Datatype must contain either @id or base property');
      } else if (
        dt['http://www.w3.org/ns/csvw#base'] in CSVW2RDFConvertor.dtUris
      ) {
        dtUri = CSVW2RDFConvertor.dtUris[dt['http://www.w3.org/ns/csvw#base']];
      } else if (dt['http://www.w3.org/ns/csvw#base'] === 'string') {
        return lang
          ? literal(value, lang)
          : literal(value, commonPrefixes.xsd + 'string');
      } else {
        dtUri = commonPrefixes.xsd + dt['http://www.w3.org/ns/csvw#base'];
      }
    }
    return literal(value, dtUri);
  }

  private debugCol(
    col: Expanded<CsvwColumnDescription>,
    table: Expanded<CsvwTableDescription>
  ) {
    let res = (col['http://www.w3.org/ns/csvw#name'] || col['@id']) as string;
    if (table) {
      res += ` in table ${table['http://www.w3.org/ns/csvw#url']}`;
    }
    return res;
  }

  /**
   * get value of inherited property
   * @param levels - levels of inheritance (current, parent, grandparent, ...)
   */
  private inherit<K extends keyof Expanded<CsvwInheritedProperties>>(
    prop: K,
    ...levels: (Expanded<CsvwInheritedProperties> | undefined)[]
  ): Expanded<CsvwInheritedProperties>[K] {
    for (const level of levels) {
      if (level?.[prop] !== undefined) {
        return level[prop];
      }
    }
    return undefined;
  }

  private static dtUris: Partial<Record<CsvwBuiltinDatatype, string>> = {
    xml: commonPrefixes.rdf + 'XMLLiteral',
    html: commonPrefixes.rdf + 'HTML',
    json: commonPrefixes.csvw + 'JSON',
    number: commonPrefixes.xsd + 'double',
    any: commonPrefixes.xsd + 'anyAtomicType',
    binary: commonPrefixes.xsd + 'base64Binary',
    datetime: commonPrefixes.xsd + 'dateTime',
  };
}

interface PrefixCCResponse {
  [key: string]: string;
}
