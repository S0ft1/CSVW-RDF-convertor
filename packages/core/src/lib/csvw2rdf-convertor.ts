import { DescriptorWrapper } from './core.js';
import { Expanded } from './types/descriptor/expanded.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import { RDFSerialization } from './types/rdf-serialization.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { DataFactory, Quad } from 'n3';
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

    let groupNode;
    //1
    if(input.isTableGroup){
      if(input.descriptor['@id'] === undefined){
        groupNode = blankNode();
      }
      else {
        groupNode = namedNode(input.descriptor['@id']);
      }
    }

    const descr = input.getTables();
    const table = descr.next();
    //2
    await store.put(quad(
      groupNode as any,
      namedNode('rdf:type'),
      namedNode('csvw:TableGroup'),
      defaultGraph(),
    ));

    //3
    //TODO: implement the third rule, for this utility functions will be created

    
    //throw new Error('Not implemented.');
    store.close();
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
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg: CsvwTableGroupDescription
  ) {
    const { literal } = DataFactory;
    const dtOrBuiltin = this.inherit(
      'datatype',
      col,
      table.tableSchema,
      table,
      tg
    );
    if (!dtOrBuiltin) {
      throw new Error(`No datatype specified for ${this.debugCol(col, table)}`);
    }
    const dt =
      typeof dtOrBuiltin === 'string' ? { base: dtOrBuiltin } : dtOrBuiltin;
    let dtUri = dt['@id'];
    const lang = this.inherit('lang', col, table.tableSchema, table, tg);
    if (!dtUri) {
      if (!dt.base) {
        throw new Error('Datatype must contain either @id or base property');
      } else if (dt.base in CSVW2RDFConvertor.dtUris) {
        dtUri = CSVW2RDFConvertor.dtUris[dt.base];
      } else if (dt.base === 'string') {
        return lang
          ? literal(value, lang)
          : literal(value, commonPrefixes.xsd + 'string');
      } else {
        dtUri = commonPrefixes.xsd + dt.base;
      }
    }
    return literal(value, dtUri);
  }

  private debugCol(col: CsvwColumnDescription, table: CsvwTableDescription) {
    let res = (col.name || col['@id']) as string;
    if (table) {
      res += ` in table ${table.url}`;
    }
    return res;
  }

  /**
   * get value of inherited property
   * @param levels - levels of inheritance (current, parent, grandparent, ...)
   */
  private inherit<K extends keyof CsvwInheritedProperties>(
    prop: K,
    ...levels: (CsvwInheritedProperties | undefined)[]
  ): CsvwInheritedProperties[K] {
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
