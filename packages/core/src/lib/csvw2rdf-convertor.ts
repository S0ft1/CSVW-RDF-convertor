import { DescriptorWrapper } from './core.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import N3, { BlankNode, DataFactory, Literal, NamedNode } from 'n3';
import { Csvw2RdfOptions } from './conversion-options.js';
import { CsvwBuiltinDatatype } from './types/descriptor/datatype.js';
import { commonPrefixes } from './utils/prefix.js';
import { CsvwInheritedProperties } from './types/descriptor/inherited-properties.js';
import { CsvwColumnDescription } from './types/descriptor/column-description.js';
import { defaultResolveFn, defaultResolveStreamFn } from './req-resolve.js';
import { CSVParser } from './csv-parser.js';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
const { rdf, csvw, xsd } = commonPrefixes;

export class CSVW2RDFConvertor {
  private options: Required<Csvw2RdfOptions>;
  private store: Quadstore;
  public constructor(options?: Csvw2RdfOptions) {
    this.options = this.setDefaults(options);
  }

  private async openStore() {
    const backend = new MemoryLevel() as any;
    // different versions of RDF.js types in quadstore and n3
    this.store = new Quadstore({
      backend,
      dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
    });
    await this.store.open();
  }

  public async convert(input: DescriptorWrapper) {
    await this.openStore();

    // 1
    const groupNode = this.createNode(
      input.isTableGroup ? input.descriptor : {}
    );

    //2
    await this.emitTriple(
      groupNode,
      namedNode(rdf + 'type'),
      namedNode(csvw + 'TableGroup')
    );
    //3
    //TODO: implement the third rule, for this utility functions will be created

    //4
    for (const table of input.getTables()) {
      if (table.suppressOutput) continue;
      //4.1
      const tableNode = this.createNode(table);
      //4.2
      await this.emitTriple(groupNode, namedNode(csvw + 'table'), tableNode);
      //4.3
      await this.emitTriple(
        tableNode,
        namedNode(rdf + 'type'),
        namedNode(csvw + 'Table')
      );
      //4.4
      await this.emitTriple(
        tableNode,
        namedNode(csvw + 'url'),
        literal(table.url)
      );
      //4.5
      //TODO: implementovat
      //4.6
      let rowNum = 0;
      const csvStream = await this.options.resolveCsvStreamFn(
        table.url,
        input.descriptor['@id'] ?? this.options.baseIRI
      );

      for await (const row of csvStream.pipeThrough(
        new CSVParser(table.dialect ?? input.descriptor.dialect ?? {})
      )) {
        rowNum++;
        //4.6.1
        const rowNode: BlankNode = blankNode();
        //4.6.2
        await this.emitTriple(tableNode, namedNode(csvw + 'row'), rowNode);
        //4.6.3
        await this.emitTriple(
          rowNode,
          namedNode(rdf + 'type'),
          namedNode(csvw + 'Row')
        );
        //4.6.4
        await this.emitTriple(
          rowNode,
          namedNode(csvw + 'rownum'),
          literal(rowNum.toString(), xsd + 'integer')
        );
        //4.6.5
        await this.emitTriple(
          rowNode,
          namedNode(csvw + 'url'),
          namedNode(table.url + '#' + rowNum.toString())
        );
        //4.6.6
        const titles = this.toArray(table.tableSchema?.rowTitles);
        const titlemap: Record<string, number> = {};
        for (let i = 0; i < titles.length; i++) {
          titlemap[table.tableSchema?.columns?.[i].name as string] = i;
        }

        for (const title of titles) {
          const lang = this.inherit(
            'lang',
            table.tableSchema?.columns?.[titlemap[title]],
            table.tableSchema,
            table,
            input.isTableGroup ? input.descriptor : undefined
          );
          await this.emitTriple(
            rowNode,
            namedNode(csvw + 'title'),
            literal(title, lang)
          );
        }

        //4.6.7
        //TODO:

        //4.6.8
        const cellBlank: BlankNode = blankNode();
        for (let i = 0; i < row.length; ++i) {
          const col = table.tableSchema?.columns?.[i] as CsvwColumnDescription;

          if (col.suppressOutput === false) {
            //4.6.8.2
            const subject =
              col.aboutUrl === undefined ? cellBlank : namedNode(col.aboutUrl);
            await this.emitTriple(
              rowNode,
              namedNode(csvw + 'describes'),
              subject
            );
            const predicate =
              col.propertyUrl === undefined
                ? namedNode(table.url + '#' + col.name)
                : namedNode(col.propertyUrl);

            if (col.valueUrl === undefined) {
              if (col.separator !== undefined) {
                const parts = row[i].split(col.separator);
                if (col.ordered === true) {
                  //4.6.8.5/6
                  const list = this.createRDFList(parts);
                  await this.emitTriple(subject, predicate, list);
                } else {
                  for (const val of parts) {
                    await this.emitTriple(
                      subject,
                      predicate,
                      this.interpretDatatype(
                        val,
                        col,
                        table,
                        input.descriptor as CsvwTableGroupDescription
                      )
                    );
                  }
                }
              } else {
                //4.6.8.7
                await this.emitTriple(
                  subject,
                  predicate,
                  this.interpretDatatype(
                    row[i],
                    col,
                    table,
                    input.descriptor as CsvwTableGroupDescription
                  )
                );
              }
            } else {
              //4.6.8.4
              await this.emitTriple(
                subject,
                predicate,
                namedNode(col.valueUrl)
              );
            }
          }
        }
      }
    }

    const writer = new N3.Writer(process.stdout, {
      end: false,
      prefixes: commonPrefixes,
    });
    writer.addQuads((await this.store.get({})).items);
    writer.end();
    await this.store.close();
  }

  private createRDFList(arr: string[]): NamedNode | Literal {
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

  private async emitTriple(
    first: NamedNode | BlankNode,
    second: NamedNode,
    third: NamedNode | BlankNode | Literal
  ): Promise<void> {
    await this.store.put(quad(first, second, third, defaultGraph()));
  }

  private createNode(input: { '@id'?: string }) {
    if (input['@id'] === undefined) {
      return blankNode();
    } else {
      return namedNode(input['@id']);
    }
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

  private setDefaults(options?: Csvw2RdfOptions): Required<Csvw2RdfOptions> {
    options ??= {};
    return {
      pathOverrides: options.pathOverrides ?? [],
      offline: options.offline ?? false,
      resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveFn,
      resolveCsvStreamFn: options.resolveCsvStreamFn ?? defaultResolveStreamFn,
      baseIRI: options.baseIRI ?? '',
    };
  }
}
