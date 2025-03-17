import { DescriptorWrapper } from './core.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { BlankNode, DataFactory, Literal, NamedNode } from 'n3';
import { Csvw2RdfOptions } from './conversion-options.js';
import { CsvwBuiltinDatatype } from './types/descriptor/datatype.js';
import { commonPrefixes } from './utils/prefix.js';
import { CsvwInheritedProperties } from './types/descriptor/inherited-properties.js';
import { CsvwColumnDescription } from './types/descriptor/column-description.js';
import { defaultResolveFn, defaultResolveStreamFn } from './req-resolve.js';
import { CSVParser } from './csv-parser.js';
import { coerceArray } from './utils/coerce.js';
import { CsvwDialectDescription } from './types/descriptor/dialect-description.js';
import { parseTemplate, Template } from 'url-template';
import { MemoryLevel } from 'memory-level';
import { Stream } from '@rdfjs/types';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
const { rdf, csvw, xsd } = commonPrefixes;

interface Templates {
  about: Record<string, Template>;
  property: Record<string, Template>;
  value: Record<string, Template>;
}

/** Class responsible for converting from CSVW to RDF.*/
export class CSVW2RDFConvertor {
  private options: Required<Csvw2RdfOptions>;
  private store: Quadstore;

  /**
   * Creates a new instance of the convertor.
   * @param {Csvw2RdfOptions} options - Options for the convertor.
   *@constructor
   */
  public constructor(options?: Csvw2RdfOptions) {
    this.options = this.setDefaults(options);
  }

  /**
   * Creates and opens a new quadstore in the current instance of CSVW2RDFConvertor.
   */
  private async openStore() {
    const backend = new MemoryLevel() as any;
    // different versions of RDF.js types in quadstore and n3
    this.store = new Quadstore({
      backend,
      dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
    });
    await this.store.open();
  }

  /**
   * Main method for converting a CSVW descriptor to RDF.
   * Viz https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf
   * @param {DescriptorWrapper} input - The descriptor to be converted.
   */
  public async convert(input: DescriptorWrapper): Promise<Stream> {
    await this.openStore();

    // 1
    const groupNode = this.createNode(
      input.isTableGroup ? input.descriptor : {}
    );
    if (!this.options.minimal) {
      //2
      await this.emitTriple(
        groupNode,
        namedNode(rdf + 'type'),
        namedNode(csvw + 'TableGroup')
      );
      //3
      if (input.isTableGroup) {
        await input.setupExternalProps(
          input.descriptor.notes as string,
          groupNode,
          this.store
        );
      }
    }

    //4
    for (const table of input.getTables()) {
      if (table.suppressOutput) continue;
      const tableNode = await this.convertTable(table, input);

      // 4.2
      if (!this.options.minimal) {
        await this.emitTriple(groupNode, namedNode(csvw + 'table'), tableNode);
      }
    }

    const outStream = this.store.match();
    outStream.once('end', () => this.store.close());
    return outStream;
  }

  /**
   * Converts a table to RDF.
   * @param {CsvwTableDescription} table - The table to be converted.
   * @param {DescriptorWrapper} input - Input descriptor.
   */
  private async convertTable(
    table: CsvwTableDescription,
    input: DescriptorWrapper
  ) {
    //4.1
    const tableNode = this.createNode(table);
    table.url =
      (
        URL.parse(table.url) ??
        URL.parse(table.url, this.options.baseIRI || input.descriptor['@id'])
      )?.href ?? table.url;
    //4.2 is done in the caller

    if (!this.options.minimal) {
      //4.2 is done in the caller
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
        namedNode(table.url)
      );
      //4.5
      await input.setupExternalProps(
        table.notes as string,
        tableNode,
        this.store
      );
    }
    //4.6
    let rowNum = 0;
    const csvStream = // table.url is already absolute
      (await this.options.resolveCsvStreamFn(table.url, table.url)).pipeThrough(
        new CSVParser(table.dialect ?? input.descriptor.dialect ?? {})
      );
    const iter = csvStream[Symbol.asyncIterator]();
    await this.processCsvHeader(
      iter,
      table,
      table.dialect ?? input.descriptor.dialect ?? {}
    );
    const templates = this.prepareTemplates(table, input);
    const rowsOffset = this.getSrcRowsOffset(
      table.dialect ?? input.descriptor.dialect ?? {}
    );

    for await (const row of iter) {
      const rowNode = await this.convertTableRow(
        row,
        ++rowNum,
        rowsOffset,
        templates,
        table,
        input
      );
      if (!this.options.minimal) {
        await this.emitTriple(tableNode, namedNode(csvw + 'row'), rowNode);
      }
    }
    return tableNode;
  }
  private getSrcRowsOffset(dialect: CsvwDialectDescription) {
    const headerRows =
      dialect.headerRowCount ?? (dialect.header ?? true ? 1 : 0);
    return headerRows + (dialect.skipRows ?? 0);
  }

  private prepareTemplates(
    table: CsvwTableDescription,
    input: DescriptorWrapper
  ): Templates {
    const templates: Templates = {
      about: {},
      property: {},
      value: {},
    };
    const tg = input.isTableGroup ? input.descriptor : undefined;
    const types = ['about', 'property', 'value'] as const;
    for (const col of table.tableSchema?.columns ?? []) {
      for (const type of types) {
        const template = this.inherit(
          `${type}Url`,
          col,
          table.tableSchema,
          table,
          tg
        );
        if (template === undefined) continue;
        templates[type][col.name as string] = parseTemplate(template);
      }
    }

    return templates;
  }

  /**
   * Processes the header of a CSV file.
   * @param {AsyncIterator<string[]>} stream  - Input stream
   * @param {CsvwTableDescription} table - Table description
   * @param {CsvwDialectDescription} dialect - Dialect description
   */
  private async processCsvHeader(
    stream: AsyncIterator<string[]>,
    table: CsvwTableDescription,
    dialect: CsvwDialectDescription
  ) {
    const headerRowCount =
      dialect.headerRowCount ?? (dialect.header ?? true ? 1 : 0);
    if (table.tableSchema === undefined) table.tableSchema = {};
    if (table.tableSchema.columns === undefined) table.tableSchema.columns = [];
    for (let i = 0; i < headerRowCount; ++i) {
      const header = await stream.next();
      if (header.done) {
        throw new Error('CSV stream ended before header was read');
      }
      const vals = header.value.slice(dialect.skipColumns ?? 0);
      for (let j = 0; j < vals.length; ++j) {
        if (!vals[j]) continue;
        let col = table.tableSchema.columns[j];
        if (!col) {
          col = {};
          table.tableSchema.columns[j] = col;
        }
        if (col.titles === undefined) col.titles = [vals[j]];
        else if (Array.isArray(col.titles)) col.titles.push(vals[j]);
        else if (typeof col.titles === 'string') {
          col.titles = [col.titles, vals[j]];
        } else {
          col.titles['en'] = vals[j];
        }
      }
    }
  }

  /**
   * Converts table row to RDF by row number.
   * @param {string[]} row - The row to be converted.
   * @param {number} rowNum - The row number.
   * @param {CsvwTableDescription} table - The table description.
   * @param {DescriptorWrapper} input - The input descriptor.
   * @returns
   */
  private async convertTableRow(
    row: string[],
    rowNum: number,
    rowsOffset: number,
    templates: Templates,
    table: CsvwTableDescription,
    input: DescriptorWrapper
  ) {
    //4.6.1
    const rowNode: BlankNode = blankNode();
    //4.6.2 done by caller

    if (!this.options.minimal) {
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
        literal(rowNum.toString(), namedNode(xsd + 'integer'))
      );
      //4.6.5
      await this.emitTriple(
        rowNode,
        namedNode(csvw + 'url'),
        namedNode(table.url + '#' + rowNum.toString())
      );
      //4.6.6
      const titles = coerceArray(table.tableSchema?.rowTitles);
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
      // implementation dependent, based on notes on the table, we skip this
    }

    const colsOffset =
      (table.dialect ?? input.descriptor.dialect ?? {}).skipColumns ?? 0;

    //4.6.8
    const defaultCellSubj = blankNode();
    for (let i = 0; i < row.length; ++i) {
      const col = table.tableSchema?.columns?.[i] as CsvwColumnDescription;
      if (col.suppressOutput) continue;

      const tableSep = this.inherit(
        'separator',
        table.tableSchema,
        table,
        input.descriptor
      );
      const values = Object.fromEntries(
        table.tableSchema?.columns?.map((col, i) => {
          const sep = col.separator ?? tableSep;
          return [
            col.name as string,
            sep ? row[i].replaceAll(sep, ',') : row[i],
          ];
        }) ?? []
      );
      await this.convertRowCell(
        col,
        row,
        values,
        defaultCellSubj,
        rowNode,
        input,
        table,
        templates,
        rowNum,
        rowsOffset,
        i,
        colsOffset
      );
    }
    return rowNode;
  }

  /**
   * Converts a cell of a row to RDF.
   * @param {CsvwColumnDescription} col - The column description
   * @param {string} value - The value of the cell
   * @param {BlankNode} defaultSubj - The default subject
   * @param {BlankNode} rowNode - The row node
   * @param {DescriptorWrapper} input - The input descriptor
   * @param {CsvwTableDescription} table - The table description
   */
  private async convertRowCell(
    col: CsvwColumnDescription,
    row: string[],
    values: Record<string, string>,
    defaultSubj: BlankNode,
    rowNode: BlankNode,
    input: DescriptorWrapper,
    table: CsvwTableDescription,
    templates: Templates,
    rowNum: number,
    rowsOffset: number,
    colNum: number,
    colsOffset: number
  ) {
    //4.6.8.1
    const subject =
      templates.about[col.name as string] === undefined
        ? defaultSubj
        : this.templateUri(
            templates.about[col.name as string],
            colNum,
            colNum + colsOffset,
            rowNum,
            rowNum + rowsOffset,
            col.name as string,
            values,
            table.url
          );
    if (!this.options.minimal) {
      //4.6.8.2
      await this.emitTriple(rowNode, namedNode(csvw + 'describes'), subject);
    }
    const predicate =
      templates.property[col.name as string] === undefined
        ? namedNode(table.url + '#' + col.name)
        : this.templateUri(
            templates.property[col.name as string],
            colNum,
            colNum + colsOffset,
            rowNum,
            rowNum + rowsOffset,
            col.name as string,
            values,
            table.url
          );
    const tg = input.isTableGroup
      ? (input.descriptor as CsvwTableGroupDescription)
      : undefined;

    if (templates.value[col.name as string] === undefined) {
      if (col.separator !== undefined) {
        const parts = row[colNum].split(col.separator);
        if (col.ordered === true) {
          //4.6.8.5/6
          const list = await this.createRDFList(parts, col, table, tg);
          await this.emitTriple(subject, predicate, list);
        } else {
          for (const val of parts) {
            await this.emitTriple(
              subject,
              predicate,
              this.interpretDatatype(val, col, table, tg)
            );
          }
        }
      } else {
        //4.6.8.7
        if (col.required !== false || row[colNum] !== '') {
          await this.emitTriple(
            subject,
            predicate,
            this.interpretDatatype(row[colNum], col, table, tg)
          );
        }
      }
    } else {
      //4.6.8.4
      await this.emitTriple(
        subject,
        predicate,
        this.templateUri(
          templates.value[col.name as string],
          colNum,
          colNum + colsOffset,
          rowNum,
          rowNum + rowsOffset,
          col.name as string,
          values,
          table.url
        )
      );
    }
  }
  /**
   * Creates an RDF list https://ontola.io/blog/ordered-data-in-rdf based on rules provided at https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf.
   * @param {string[]} parts  - Values of the list
   * @param {CsvwColumnDescription} col - Column description
   * @param {CsvwTableDescription} table - Table description
   * @param {CsvwTableGroupDescription | undefined} tg - Table group description
   * @returns The head of the rdf list
   */
  private async createRDFList(
    parts: string[],
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg: CsvwTableGroupDescription | undefined
  ): Promise<BlankNode> {
    const head = blankNode();
    let current = head;

    for (const part of parts) {
      await this.emitTriple(
        current,
        namedNode(rdf + 'type'),
        namedNode(rdf + 'List')
      );
      await this.emitTriple(
        current,
        namedNode(rdf + 'first'),
        this.interpretDatatype(part, col, table, tg)
      );
      const next = blankNode();
      await this.emitTriple(current, namedNode(rdf + 'rest'), next);
      current = next;
    }
    await this.emitTriple(
      current,
      namedNode(rdf + 'rest'),
      namedNode(rdf + 'nil')
    );
    return head;
  }

  /**
   * Emits a triple to this instance's quadstore.
   */
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

  /**
   * Inteprets the datatype of a value based on the description.
   * @param {string} value - string value to be interpreted
   * @param {CsvwColumnDescription} col - Column description
   * @param {CsvwTableDescription} table - Table description
   * @param {CsvwTableGroupDescription | undefined} tg - Table group description, could be undefined if there is no table group
   * @returns Correctly build RDF literal
   */
  private interpretDatatype(
    value: string,
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg: CsvwTableGroupDescription | undefined
  ) {
    const dtOrBuiltin = this.inherit(
      'datatype',
      col,
      table.tableSchema,
      table,
      tg
    );
    if (!dtOrBuiltin) {
      throw new Error(
        `No datatype specified for ${col.name || col['@id']} in table ${
          table.url
        }`
      );
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
      } else {
        dtUri = xsd + dt.base;
      }
    } else {
      dtUri = this.expandIri(dtUri);
    }
    if (dtUri === xsd + 'string' && lang) return literal(value, lang);
    if (dtUri === xsd + 'anyURI') return namedNode(value);
    return literal(value, namedNode(dtUri as string));
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
    xml: rdf + 'XMLLiteral',
    html: rdf + 'HTML',
    json: csvw + 'JSON',
    number: xsd + 'double',
    any: xsd + 'anyAtomicType',
    binary: xsd + 'base64Binary',
    datetime: xsd + 'dateTime',
  };

  /**
   * Sets default values to options if no value is provided.
   * @param options
   * @returns Corrected options
   */
  private setDefaults(options?: Csvw2RdfOptions): Required<Csvw2RdfOptions> {
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

  private expandIri(iri: string): string {
    const i = iri.indexOf(':');
    if (i === -1) return iri;
    const prefix = iri.slice(0, i);
    if (prefix in commonPrefixes) {
      return (
        commonPrefixes[prefix as keyof typeof commonPrefixes] + iri.slice(i + 1)
      );
    }
    return iri;
  }

  private templateUri(
    template: Template,
    col: number,
    srcCol: number,
    row: number,
    srcRow: number,
    colName: string,
    colVals: Record<string, any>,
    baseIRI: string
  ) {
    let uri = template.expand({
      ...colVals,
      _column: col,
      _sourceColumn: srcCol,
      _row: row,
      _sourceRow: srcRow,
      _name: decodeURIComponent(colName),
    });
    uri = this.expandIri(uri);
    uri = (URL.parse(uri) ?? URL.parse(uri, baseIRI))?.href ?? uri;
    if (this.options.templateIRIs) {
      uri = decodeURI(uri);
    }
    return namedNode(uri);
  }
}
