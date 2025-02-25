import { DescriptorWrapper } from './core.js';
import { Expanded } from './types/descriptor/expanded.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import { RDFSerialization } from './types/rdf-serialization.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { BlankNode, DataFactory, Literal, NamedNode, Quad } from 'n3';
import { Csvw2RdfOptions } from './conversion-options.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from './types/descriptor/datatype.js';
import { commonPrefixes } from './utils/prefix.js';
import { CsvwInheritedProperties } from './types/descriptor/inherited-properties.js';
import { CsvwColumnDescription } from './types/descriptor/column-description.js';
import jsonld, { NodeObject } from 'jsonld';
import { defaultResolveFn, defaultResolveStreamFn } from './req-resolve.js';
import { CSVParser } from './csv-parser.js';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
export class CSVW2RDFConvertor {
  private options: Required<Csvw2RdfOptions>;
  public constructor(options: Csvw2RdfOptions) {
    this.options = setDefaults(options);
  }

  public async convert(input: DescriptorWrapper) {
    const backend = new MemoryLevel() as any;
    const { rdf, csvw, xsd } = commonPrefixes;
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
    await this.emmitTriple(
      groupNode,
      namedNode(rdf + 'type'),
      namedNode(csvw + 'TableGroup'),
      store
    );
    //3
    //TODO: implement the third rule, for this utility functions will be created

    //4
    for (const table of input.getTables()) {
      if (table['http://www.w3.org/ns/csvw#suppressOutput'] === false) {
        //4.1
        const tableNode = this.createNamedNodeByIdOrBlankNode(table);
        //4.2
        await this.emmitTriple(
          groupNode,
          namedNode(csvw + 'table'),
          tableNode,
          store
        );
        //4.3
        await this.emmitTriple(
          tableNode,
          namedNode(rdf + 'type'),
          namedNode(csvw + 'Table'),
          store
        );
        //4.4
        await this.emmitTriple(
          tableNode,
          namedNode(csvw + 'url'),
          literal(table['http://www.w3.org/ns/csvw#url']),
          store
        );
        //4.5
        //TODO: implementovat
        //4.6
        let rowNum = 0;
        for await (const row of (
          await this.options.resolveStreamFn(
            table['http://www.w3.org/ns/csvw#url']
          )
        ).pipeThrough(
          new CSVParser(
            this.inherit(
              'http://www.w3.org/ns/csvw#dialect' as any,
              table,
              input.descriptor
            )
          )
        )) {
          rowNum++;
          //4.6.1
          const rowNode: BlankNode = blankNode();
          //4.6.2
          await this.emmitTriple(
            tableNode,
            namedNode(csvw + 'row'),
            rowNode,
            store
          );
          //4.6.3
          await this.emmitTriple(
            rowNode,
            namedNode(rdf + 'type'),
            namedNode(csvw + 'Row'),
            store
          );
          //4.6.4
          await this.emmitTriple(
            rowNode,
            namedNode(csvw + 'rownum'),
            literal(rowNum.toString(), xsd + 'integer'),
            store
          );
          //4.6.5
          await this.emmitTriple(
            rowNode,
            namedNode(csvw + 'url'),
            namedNode(
              table['http://www.w3.org/ns/csvw#url#row'] + rowNum.toString()
            ),
            store
          );
          //4.6.6
          const titles = this.toArray(
            table['http://www.w3.org/ns/csvw#tableSchema']?.[
              'http://www.w3.org/ns/csvw#rowTitles'
            ]
          );
          const titlemap: Record<string, number> = {};
          for (let i = 0; i < titles.length; i++) {
            titlemap[
              table['http://www.w3.org/ns/csvw#tableSchema']?.[
                'http://www.w3.org/ns/csvw#columns'
              ]?.[i]['http://www.w3.org/ns/csvw#name'] as string
            ] = i;
          }

          for (const title of titles) {
            const lang = this.inherit(
              'http://www.w3.org/ns/csvw#lang',
              table['http://www.w3.org/ns/csvw#tableSchema']?.[
                'http://www.w3.org/ns/csvw#columns'
              ]?.[titlemap[title]],
              table['http://www.w3.org/ns/csvw#tableSchema'],
              table,
              input.isTableGroup ? input.descriptor : undefined
            );
            await this.emmitTriple(
              rowNode,
              namedNode(csvw + 'title'),
              literal(title, lang),
              store
            );
          }

          //4.6.7
          //TODO:

          //4.6.8
          const cellBlank: BlankNode = blankNode();
          for (let i = 0; i < row.length; ++i) {
            const col = table['http://www.w3.org/ns/csvw#tableSchema']?.[
              'http://www.w3.org/ns/csvw#columns'
            ]?.[i] as Expanded<CsvwColumnDescription>;

            if (col['http://www.w3.org/ns/csvw#suppressOutput'] === false) {
              //4.6.8.2
              const subject =
                col['http://www.w3.org/ns/csvw#aboutUrl'] === undefined
                  ? cellBlank
                  : namedNode(col['http://www.w3.org/ns/csvw#aboutUrl']);
              await this.emmitTriple(
                rowNode,
                namedNode(csvw + 'describes'),
                subject,
                store
              );
              const predicate =
                col['http://www.w3.org/ns/csvw#propertyUrl'] === undefined
                  ? namedNode(
                      table['http://www.w3.org/ns/csvw#url'] +
                        '#' +
                        col['http://www.w3.org/ns/csvw#name']
                    )
                  : namedNode(col['http://www.w3.org/ns/csvw#propertyUrl']);

              if (col['http://www.w3.org/ns/csvw#valueUrl'] === undefined) {
                if (col['http://www.w3.org/ns/csvw#separator'] !== undefined) {
                  const splitted = row[i].split(
                    col['http://www.w3.org/ns/csvw#separator']
                  );
                  const list = this.createRDFList(
                    splitted,
                    col['http://www.w3.org/ns/csvw#ordered'] === true
                  );
                  if (col['http://www.w3.org/ns/csvw#ordered'] === true) {
                    //4.6.8.5/6
                    await this.emmitTriple(subject, predicate, list, store);
                  }
                } else {
                  //4.6.8.7
                  await this.emmitTriple(
                    subject,
                    predicate,
                    this.interpretDatatype(
                      row[i],
                      col,
                      table,
                      input.descriptor as Expanded<CsvwTableGroupDescription>
                    ),
                    store
                  );
                }
              } else {
                //4.6.8.4
                await this.emmitTriple(
                  subject,
                  predicate,
                  namedNode(col['http://www.w3.org/ns/csvw#valueUrl']),
                  store
                );
              }
            }
          }
        }
      }
    }
    //throw new Error('Not implemented.');
    store.close();
  }

  private createRDFList(arr: string[], ordered: boolean): NamedNode | Literal {
    //TODO: CREATE RDF LIST FROM STRING[]
    //use function interpretDatatype for creating literals
    return namedNode(arr[0]);
  }

  private toArray<T extends {}>(input: T | T[] | undefined): NonNullable<T>[] {
    if (input === undefined) {
      return [];
    }
    return Array.isArray(input) ? input : [input];
  }

  private async emmitTriple(
    first: NamedNode | BlankNode,
    second: NamedNode,
    third: NamedNode | BlankNode | Literal,
    store: Quadstore
  ): Promise<void> {
    await store.put(quad(first, second, third, defaultGraph()));
  }

  private createNamedNodeByIdOrBlankNode(
    input: Expanded<CsvwTableGroupDescription> | Expanded<CsvwTableDescription>
  ) {
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

function setDefaults(options?: Csvw2RdfOptions): Required<Csvw2RdfOptions> {
  options ??= {};
  return {
    pathOverrides: options.pathOverrides ?? [],
    offline: options.offline ?? false,
    resolveFn: options.resolveFn ?? defaultResolveFn,
    resolveStreamFn: options.resolveStreamFn ?? defaultResolveStreamFn,
  };
}
