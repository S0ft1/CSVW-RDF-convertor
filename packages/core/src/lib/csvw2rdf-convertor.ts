import { DescriptorWrapper, normalizeDescriptor } from './core.js';
import { Csvw2RdfOptions } from './conversion-options.js';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
} from './req-resolve.js';
import { CSVParser } from './csv-parser.js';

import {
  commonPrefixes,
  dateTypes,
  numericTypes,
  XSD_TEMP,
  XSD_TEMP_PREFIX,
} from './utils/prefix.js';
import { coerceArray } from './utils/coerce.js';

import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
  CsvwNumberFormat,
} from './types/descriptor/datatype.js';
import { CsvwInheritedProperties } from './types/descriptor/inherited-properties.js';
import { CsvwColumnDescription } from './types/descriptor/column-description.js';
import { CsvwDialectDescription } from './types/descriptor/dialect-description.js';

import { MemoryLevel } from 'memory-level';
import { Quadstore, StoreOpts } from 'quadstore';
import { BlankNode, DataFactory, Literal, NamedNode } from 'n3';
import { parseTemplate, Template } from 'url-template';
import { Quad, Stream } from '@rdfjs/types';
import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
import { replaceUrl } from './utils/replace-url.js';
import { format } from 'date-fns';
import { parseNumber } from './utils/parse-number.js';
import { validate as bcp47Validate } from 'bcp47-validate';
import {
  CsvwForeignKeyDefinition,
  CsvwSchemaDescription,
} from './types/descriptor/schema-description.js';
import { CsvwTransformationDefinition } from './types/descriptor/transformation-definition.js';
import { validateArray, validateIdAndType } from './utils/validation.js';
import { parseDate } from './utils/parse-date.js';
import { tz } from '@date-fns/tz';
import EventEmitter from 'node:events';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
const { rdf, csvw, xsd } = commonPrefixes;

interface Templates {
  about: Record<string, Template>;
  property: Record<string, Template>;
  value: Record<string, Template>;
}

/** Class responsible for converting from CSVW to RDF. */
export class CSVW2RDFConvertor {
  private options: Required<Csvw2RdfOptions>;
  private store: Quadstore;

  /**
   * Creates a new instance of the convertor.
   * @param {Csvw2RdfOptions} options - Options for the convertor.
   */
  public constructor(options?: Csvw2RdfOptions) {
    this.options = this.setDefaults(options);
  }

  /**
   * Main method for converting a CSVW to RDF,
   * see {@link https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf} for more information.
   * @param descriptor descriptor either as parsed or stringified JSON
   * @param originalUrl original URL of the descriptor
   * @returns RDF stream
   */
  public async convert(
    descriptor: string | AnyCsvwDescriptor,
    originalUrl?: string
  ): Promise<Stream> {
    const wrapper = await normalizeDescriptor(
      descriptor,
      this.options,
      originalUrl
    );
    return this.convertInner(wrapper);
  }

  /**
   * Convert CSVW to RDF from a CSV file URL. The descriptor will be resolved according to
   * {@link https://www.w3.org/TR/2015/REC-tabular-data-model-20151217/#locating-metadata}.
   * see {@link https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf} for more information.
   * @param url url of the CSV file
   * @returns RDF stream
   */
  public async convertFromCsvUrl(url: string) {
    const [json, resolvedUrl] = await this.resolveMetadata(url);
    console.log('Resolved metadata', resolvedUrl, json);
    const wrapper = await normalizeDescriptor(json, this.options, resolvedUrl);
    this.options.baseIRI = resolvedUrl;
    const tablesWithoutUrl = Array.from(wrapper.getTables()).filter(
      (table) => !table.url
    );
    if (tablesWithoutUrl.length > 1) {
      throw new Error('Multiple tables without URL found in the descriptor');
    }
    if (tablesWithoutUrl.length === 1) {
      tablesWithoutUrl[0].url = url;
    }

    return this.convertInner(wrapper);
  }

  private validateTableGroup(tg: CsvwTableGroupDescription) {
    this.validateInheritedProperties(tg);
    this.validateDialect(tg.dialect);
    if (!tg.tables?.length) {
      throw new Error('Table group must contain at least one table');
    }
    validateIdAndType(tg, 'TableGroup');
    validateArray(tg, 'transformations', this.validateTemplate.bind(this));
  }
  private validateTable(t: CsvwTableDescription, ts: CsvwTableDescription[]) {
    this.validateInheritedProperties(t);
    this.validateDialect(t.dialect);
    validateIdAndType(t, 'Table');
    this.validateSchema(t.tableSchema, ts);
    validateArray(t, 'transformations', this.validateTemplate.bind(this));
  }
  private validateSchema(
    schema: CsvwSchemaDescription | undefined,
    tables: CsvwTableDescription[]
  ) {
    if (!schema) return;
    validateIdAndType(schema, 'Schema');
    validateArray(schema, 'foreignKeys', (fk) =>
      this.validateForeignKey(fk, schema, tables)
    );
    validateArray(schema, 'columns', this.validateColumn.bind(this));
  }
  private validateForeignKey(
    fk: CsvwForeignKeyDefinition,
    schema: CsvwSchemaDescription,
    tables: CsvwTableDescription[]
  ) {
    const colRef = coerceArray(fk.columnReference);
    for (const col of colRef) {
      if (!schema.columns?.some((c) => c.name === col)) {
        throw new Error(`Column ${col} not found in schema`);
      }
    }

    let table: CsvwTableDescription | undefined;
    if (fk.reference.resource) {
      table = tables.find((t) => t.url === fk.reference.resource);
      if (!table) {
        throw new Error(`Table ${fk.reference.resource} not found`);
      }
    } else if (fk.reference.schemaReference) {
      table = tables.find(
        (t) => t.tableSchema?.['@id'] === fk.reference.schemaReference
      );
      if (!table) {
        throw new Error(
          `Schema ${fk.reference.schemaReference} not found in tables`
        );
      }
    }
    if (!table) {
      throw new Error('Table not found');
    }

    const remoteRef = coerceArray(fk.reference.columnReference);
    for (const col of remoteRef) {
      if (!table.tableSchema?.columns?.some((c) => c.name === col)) {
        throw new Error(`Column ${col} not found in table ${table.url}`);
      }
    }
  }
  private validateColumn(c: CsvwColumnDescription) {
    this.validateInheritedProperties(c);
    validateIdAndType(c, 'Column');
  }
  private validateInheritedProperties(props: CsvwInheritedProperties) {
    if (props.lang !== undefined && !bcp47Validate(props.lang)) {
      delete props.lang;
    }
    this.validateDatatype(props);
    for (const urlType of ['aboutUrl', 'propertyUrl', 'valueUrl'] as const) {
      if (props[urlType] !== undefined) {
        if (typeof props[urlType] !== 'string') {
          props[urlType] = '';
        }
      }
    }
  }
  private validateTemplate(template: CsvwTransformationDefinition) {
    if (!template || typeof template !== 'object') return;
    validateIdAndType(template, 'Template');
  }
  private validateDialect(dialect: CsvwDialectDescription | undefined) {
    if (!dialect) return;
    validateIdAndType(dialect, 'Dialect');
    for (const strKey of ['commentPrefix', 'delimiter'] as const) {
      if (
        dialect[strKey] !== undefined &&
        typeof dialect[strKey] !== 'string'
      ) {
        delete dialect[strKey];
      }
    }
    for (const boolKey of [
      'doubleQuote',
      'header',
      'skipBlankRows',
      'skipInitialSpace',
    ] as const) {
      if (
        dialect[boolKey] !== undefined &&
        typeof dialect[boolKey] !== 'boolean'
      ) {
        delete dialect[boolKey];
      }
    }

    if (
      dialect.headerRowCount !== undefined &&
      (typeof dialect.headerRowCount !== 'number' || dialect.headerRowCount < 0)
    ) {
      delete dialect.headerRowCount;
    }
    if (
      dialect.skipColumns !== undefined &&
      (typeof dialect.skipColumns !== 'number' || dialect.skipColumns < 0)
    ) {
      delete dialect.skipColumns;
    }
    if (
      dialect.skipRows !== undefined &&
      (typeof dialect.skipRows !== 'number' || dialect.skipRows < 0)
    ) {
      delete dialect.skipRows;
    }

    if (dialect.lineTerminators !== undefined) {
      dialect.lineTerminators = coerceArray(dialect.lineTerminators).filter(
        (t) => typeof t === 'string'
      );
    }
    if (
      dialect.quoteChar !== undefined &&
      typeof dialect.quoteChar !== 'string' &&
      dialect.quoteChar !== null
    ) {
      delete dialect.quoteChar;
    }
    if (dialect.trim !== undefined && typeof dialect.trim !== 'boolean') {
      if (['true', 'false', 'start', 'end'].includes(dialect.trim)) {
        delete dialect.trim;
      }
    }
    if (
      dialect.encoding !== undefined &&
      !Buffer.isEncoding(dialect.encoding)
    ) {
      delete dialect.encoding;
    }
  }

  private async convertInner(input: DescriptorWrapper): Promise<Stream<Quad>> {
    await this.openStore();
    if (!this.options.baseIRI) {
      this.options.baseIRI = input.descriptor['@id'] ?? '';
    }

    // 1
    const groupNode = this.createNode(
      input.isTableGroup ? input.descriptor : {}
    );
    if (input.isTableGroup) {
      this.validateTableGroup(input.descriptor as CsvwTableGroupDescription);
    }
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
    return this.replacerStream(outStream);
  }

  private replacerStream(stream: Stream<Quad>): Stream<Quad> {
    const forwardedEvents = ['readable', 'end', 'error'];
    const resultStream = new EventEmitter() as Stream<Quad>;
    resultStream.read = () => stream.read();
    for (const event of forwardedEvents) {
      stream.on(event, (...args: any[]) => {
        resultStream.emit(event, ...args);
      });
    }
    stream.on('data', (q: Quad) => {
      if (
        q.object.termType === 'Literal' &&
        q.object.datatype.value.startsWith(XSD_TEMP)
      ) {
        resultStream.emit(
          'data',
          quad(
            q.subject,
            q.predicate,
            literal(
              q.object.value,
              namedNode(q.object.datatype.value.replace(XSD_TEMP, xsd))
            ),
            q.graph
          )
        );
      } else {
        resultStream.emit('data', q);
      }
    });
    return resultStream;
  }

  /**
   * Locates metadata for tabular data,
   * see {@link https://www.w3.org/TR/2015/REC-tabular-data-model-20151217/#locating-metadata} for more information.
   * @param csvUrl CSV file url
   * @returns URL of metadata file for the given CSV file
   */
  private async resolveMetadata(
    csvUrl: string
  ): Promise<[AnyCsvwDescriptor, string]> {
    let expandedUrl = replaceUrl(csvUrl, this.options.pathOverrides);
    expandedUrl = new URL(expandedUrl, this.options.baseIRI).href;

    // metadata in a document linked to using a Link header associated with the tabular data file.
    try {
      // TODO: Maybe reconsider this resolveJsonldFn API?
      const descriptor = await this.options.resolveJsonldFn(
        expandedUrl,
        this.options.baseIRI
      );
      return [
        JSON.parse(descriptor),
        new URL(expandedUrl, this.options.baseIRI).href,
      ];
    } catch {
      // that apparently didn't work, let's move on
    }

    // metadata located through default paths which may be overridden by a site-wide location configuration.
    const cleanUrl = new URL(expandedUrl);
    cleanUrl.hash = '';

    for (const template of await this.getWellKnownUris(expandedUrl)) {
      let resolvedUrl = new URL(
        template.expand({ url: cleanUrl.toString() }),
        expandedUrl
      ).href;
      resolvedUrl = replaceUrl(resolvedUrl, this.options.pathOverrides);
      try {
        const descriptor = await this.options.resolveJsonldFn(
          resolvedUrl,
          this.options.baseIRI
        );
        return [JSON.parse(descriptor), resolvedUrl];
      } catch {
        // that didn't work either
      }
    }

    return [
      {
        '@context': 'http://www.w3.org/ns/csvw',
        'rdfs:comment': [],
        tableSchema: {
          columns: [],
        },
        url: csvUrl,
      },
      expandedUrl,
    ];
  }

  /**
   * Retrieves URI templates from well-known URI file.
   * @param url /.well-known/csvm is resolved relative to this url
   * @returns URI templates of metadata locations
   */
  private async getWellKnownUris(url: string): Promise<Template[]> {
    url = new URL('/.well-known/csvm', url).href;
    url = replaceUrl(url, this.options.pathOverrides);
    try {
      const text = await this.options.resolveWkfFn(url, this.options.baseIRI);
      if (!text) return CSVW2RDFConvertor.defaultWKs;
      return text
        .split('\n')
        .filter((template) => template.trim())
        .map((template: string) => parseTemplate(template));
    } catch {
      return CSVW2RDFConvertor.defaultWKs;
    }
  }
  private static defaultWKs = [
    parseTemplate('{+url}-metadata.json'),
    parseTemplate('csv-metadata.json'),
  ];

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
   * Converts a table to RDF.
   * @param {CsvwTableDescription} table - The table to be converted.
   * @param {DescriptorWrapper} input - Input descriptor.
   */
  private async convertTable(
    table: CsvwTableDescription,
    input: DescriptorWrapper
  ) {
    this.validateTable(table, Array.from(input.getTables()));

    //4.1
    const tableNode = this.createNode(table);
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
    const csvStream = (
      await this.options.resolveCsvStreamFn(table.url, this.options.baseIRI)
    ).pipeThrough(
      new CSVParser(table.dialect ?? input.descriptor.dialect ?? {})
    );
    const iter = csvStream[Symbol.asyncIterator]();
    const maybeRow1 = await this.processCsvHeader(
      iter,
      table,
      table.dialect ?? input.descriptor.dialect ?? {},
      input
    );
    const templates = this.prepareTemplates(table, input);
    const rowsOffset = this.getSrcRowsOffset(
      table.dialect ?? input.descriptor.dialect ?? {}
    );

    if (maybeRow1) {
      const rowNode = await this.convertTableRow(
        maybeRow1,
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

  /**
   * Prepares templates for the conversion.
   * @param {CsvwTableDescription} table - The table to be converted.
   * @param {DescriptorWrapper} input - Input descriptor.
   */
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
      if (col.suppressOutput) continue;
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
   * Processes the header of a CSV file and its embedded metadata.
   * @param {AsyncIterator<string[]>} stream  - Input stream
   * @param {CsvwTableDescription} table - Table description
   * @param {CsvwDialectDescription} dialect - Dialect description
   * @param {DescriptorWrapper} input - Input descriptor
   * @returns The first row of the table if there is no header and there are no columns defined in the table schema.
   * This row is used to determine the column count and must be passed to the {@link CSVW2RDFConvertor#convertTableRow} method.
   */
  private async processCsvHeader(
    stream: AsyncIterator<string[]>,
    table: CsvwTableDescription,
    dialect: CsvwDialectDescription,
    input: DescriptorWrapper
  ): Promise<string[] | undefined> {
    const defaultLang = this.inherit('lang', table, input.descriptor) ?? 'und';

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
          col.titles[defaultLang] = vals[j];
        }
      }
    }

    if (!table.tableSchema.columns.length) {
      const row = await stream.next();
      if (row.done) return;
      table.tableSchema.columns = row.value.map((_, i) => ({
        name: '_col.' + (i + 1),
      }));
      return row.value;
    }

    for (let i = 0; i < table.tableSchema.columns.length; ++i) {
      const col = table.tableSchema.columns[i];
      if (col.name || !col.titles) continue;
      if (typeof col.titles === 'string') col.name = col.titles;
      else if (Array.isArray(col.titles)) col.name = col.titles[0];
      else {
        if (defaultLang in col.titles) {
          col.name = coerceArray(col.titles[defaultLang])[0];
        } else {
          for (const key in col.titles) {
            if (key.startsWith(defaultLang)) {
              col.name = coerceArray(col.titles[key])[0];
              break;
            }
          }
        }
      }
      col.name = col.name
        ? encodeURIComponent(col.name).replaceAll('-', '%2D')
        : '_col.' + (i + 1);
    }
    return undefined;
  }

  /**
   * Validate datatype formats of the column descriptions in the table.
   * @param table - Table description
   */
  private validateDatatype(props: CsvwInheritedProperties) {
    const dt = props.datatype;
    if (dt === undefined) return;
    if (typeof dt === 'string') {
      if (!(dt in CSVW2RDFConvertor.dtUris)) {
        delete props.datatype;
      }
      return;
    }
    if (dt.base && !(dt.base in CSVW2RDFConvertor.dtUris)) {
      dt.base = 'string';
    }
    if (!dt.base || !dt.format) return;

    if (numericTypes.has(xsd + dt.base)) {
      if (typeof dt.format === 'string') {
        dt.format = { pattern: dt.format };
      }
      if (typeof (dt.format as CsvwNumberFormat).decimalChar !== 'string') {
        (dt.format as CsvwNumberFormat).decimalChar = '.';
      }
      if (typeof (dt.format as CsvwNumberFormat).groupChar !== 'string') {
        (dt.format as CsvwNumberFormat).groupChar = ',';
      }
      return;
    }
    if (typeof dt.format !== 'string') {
      dt.format = undefined;
      return;
    }

    if (dt.base === 'boolean') {
      if (!dt.format.includes('|')) {
        dt.format = undefined;
      }
      return;
    }

    if (!dateTypes.has(xsd + dt.base) && dt.base !== 'datetime') {
      dt.format = new RegExp(dt.format);
    }
  }

  /**
   * Converts table row to RDF by row number.
   * @param {string[]} row - The row to be converted.
   * @param {number} rowNum - The row number.
   * @param {number} rowsOffset - The offset of the rows.
   * @param {Templates} templates - Templates for the conversion.
   * @param {CsvwTableDescription} table - The table description.
   * @param {DescriptorWrapper} input - The input descriptor.
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
        namedNode(table.url + '#row=' + (rowNum + rowsOffset))
      );

      //4.6.7
      // implementation dependent, based on notes on the table, we skip this
    }

    const colsOffset =
      (table.dialect ?? input.descriptor.dialect ?? {}).skipColumns ?? 0;

    //4.6.8
    const defaultCellSubj = blankNode();
    const totalCols = Math.max(
      table.tableSchema?.columns?.length ?? 0,
      row.length
    );
    const tg = input.isTableGroup
      ? (input.descriptor as CsvwTableGroupDescription)
      : undefined;
    const values: Record<string, string | string[] | null> = {};

    // fill values (we need them all to process template uris)
    for (let i = 0; i < totalCols; ++i) {
      const col = table.tableSchema?.columns?.[i] as CsvwColumnDescription;
      const [dtUri, dt] = this.normalizeDatatype(col, table, tg);

      values[col.name as string] = await this.interpretDatatype(
        row[i],
        dtUri,
        dt,
        col,
        table,
        tg
      );
    }

    // now we can safely process the values
    for (let i = 0; i < totalCols; ++i) {
      const col = table.tableSchema?.columns?.[i] as CsvwColumnDescription;
      if (col.suppressOutput || values[col.name as string] === null) continue;

      await this.convertRowCell(
        col,
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

    if (!this.options.minimal) {
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
        const val = values[title];
        if (!val) continue;
        await this.emitTriple(
          rowNode,
          namedNode(csvw + 'title'),
          literal(values[title] as string, lang)
        );
      }
    }

    return rowNode;
  }

  /**
   * Converts a cell of a row to RDF.
   * @param {CsvwColumnDescription} col - Column description
   * @param {Record<string, string | string[] | null>} values - Values of the row
   * @param {BlankNode} defaultSubj - Default subject
   * @param {BlankNode} rowNode - The row node
   * @param {DescriptorWrapper} input - The input descriptor.
   * @param {CsvwTableDescription} table - The table description.
   * @param {Templates} templates - Templates for the conversion.
   * @param {number} rowNum - The row number.
   * @param {number} rowsOffset - The offset of the rows.
   * @param {number} colNum - The column number.
   * @param {number} colsOffset - The offset of the columns.
   */
  private async convertRowCell(
    col: CsvwColumnDescription,
    values: Record<string, string | string[] | null>,
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
    const [dtUri] = this.normalizeDatatype(
      col,
      table,
      input.isTableGroup
        ? (input.descriptor as CsvwTableGroupDescription)
        : undefined
    );

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
    const lang = this.inherit('lang', col, table.tableSchema, table, tg);

    if (templates.value[col.name as string] === undefined) {
      const val = values[col.name as string];
      if (val === null) return;
      if (Array.isArray(val)) {
        if (this.inherit('ordered', col, table.tableSchema, table, tg)) {
          const head = await this.createRDFList(
            val.map((v) => this.datatypeToLiteral(v, dtUri as string, lang))
          );
          await this.emitTriple(subject, predicate, head);
        } else {
          for (const item of val) {
            await this.emitTriple(
              subject,
              predicate,
              this.datatypeToLiteral(item, dtUri as string, lang)
            );
          }
        }
      } else {
        await this.emitTriple(
          subject,
          predicate,
          this.datatypeToLiteral(val, dtUri as string, lang)
        );
      }
    } else {
      const val = this.templateUri(
        templates.value[col.name as string],
        colNum,
        colNum + colsOffset,
        rowNum,
        rowNum + rowsOffset,
        col.name as string,
        values,
        table.url
      );
      await this.emitTriple(subject, predicate, val);
    }
  }

  /**
   * Get expanded datatype URI and description.
   * @param col - column description
   * @param table - table description
   * @param tg - table group description
   * @returns [datatype URI, datatype description]
   */
  private normalizeDatatype(
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg: CsvwTableGroupDescription | undefined
  ) {
    const dtOrBuiltin =
      this.inherit('datatype', col, table.tableSchema, table, tg) ?? 'string';
    const dt =
      typeof dtOrBuiltin === 'string' ? { base: dtOrBuiltin } : dtOrBuiltin;
    let dtUri = dt['@id'];

    if (!dtUri) {
      dt.base ??= 'string';
      if (dt.base in CSVW2RDFConvertor.dtUris) {
        dtUri = CSVW2RDFConvertor.dtUris[dt.base];
      } else {
        dtUri = xsd + dt.base;
      }
    } else {
      dtUri = this.expandIri(dtUri);
    }
    return [dtUri, dt] as [string, CsvwDatatype];
  }

  /**
   * Creates an RDF list https://ontola.io/blog/ordered-data-in-rdf based on rules provided at https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf.
   * @param values  - Values of the list
   * @returns The head of the rdf list
   */
  private async createRDFList(
    values: (NamedNode | Literal)[]
  ): Promise<BlankNode> {
    const head = blankNode();
    let current = head;

    for (let i = 0; i < values.length - 1; ++i) {
      await this.emitTriple(current, namedNode(rdf + 'first'), values[i]);
      const next = blankNode();
      await this.emitTriple(current, namedNode(rdf + 'rest'), next);
      current = next;
    }

    await this.emitTriple(
      current,
      namedNode(rdf + 'first'),
      values[values.length - 1]
    );
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
   * @returns Correctly built RDF literal
   */
  private async interpretDatatype(
    value: string,
    dtUri: string,
    dt: CsvwDatatype,
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg: CsvwTableGroupDescription | undefined
  ) {
    const normalizedValue = this.normalizeValue(value, dtUri, col, table, tg);
    if (normalizedValue === null) return null;
    if (Array.isArray(normalizedValue)) {
      const formatted = normalizedValue
        .map((val) => this.formatValue(val, dtUri as string, dt, col))
        .filter((val) => val !== null);
      return formatted;
    } else {
      const object = this.formatValue(normalizedValue, dtUri, dt, col);
      return object;
    }
  }

  /**
   * Convert string value to RDF literal based on the datatype URI.
   * Quadstore cannot store NaN as a literal, so we use a temporary prefix for numeric types.
   * This is later replaced in the {@link CSVW2RDFConvertor#replacerStream} method.
   * @param value - string value to be converted
   * @param dtUri - datatype URI
   * @param lang - language tag
   * @returns RDF literal
   */
  private datatypeToLiteral(
    value: string,
    dtUri: string,
    lang?: string
  ): Literal {
    if (numericTypes.has(dtUri)) {
      return literal(value, namedNode(XSD_TEMP_PREFIX + dtUri));
    }
    if (dtUri === xsd + 'string' && lang) {
      return literal(value, lang);
    }
    return literal(value, namedNode(dtUri));
  }

  /**
   * Format string value based on the datatype and column description.
   * @param value - string value to be converted
   * @param dtUri - datatype URI
   * @param dt - datatype description
   * @param col - column description
   * @param lang - language tag
   * @returns the formatted value
   */
  private formatValue(
    value: string,
    dtUri: string,
    dt: CsvwDatatype,
    col: CsvwColumnDescription
  ): string | null {
    if (value === '') value = col.default ?? '';
    if (this.isValueNull(value, col)) return null;

    if (numericTypes.has(dtUri)) {
      value = parseNumber(value, dt.format as CsvwNumberFormat);
    } else if (dateTypes.has(dtUri)) {
      value = this.formatDate(value, dtUri, dt);
    } else if (dtUri === xsd + 'boolean') {
      if (dt.format) {
        const [trueVal] = (dt.format as string).split('|');
        value = value === trueVal ? 'true' : 'false';
      } else {
        value = value === 'true' || value === '1' ? 'true' : 'false';
      }
    } else if (
      dt.format instanceof RegExp &&
      dtUri !== csvw + 'json' &&
      dtUri !== xsd + 'xml' &&
      dtUri !== xsd + 'html'
    ) {
      // maybe validate?
    }

    return value;
  }

  private formatDate(value: string, dtUri: string, dt: CsvwDatatype) {
    const date = parseDate(value, dtUri, dt.format as string);
    let resultFormat =
      dtUri === xsd + 'date'
        ? 'yyyy-MM-dd'
        : dtUri === xsd + 'time'
        ? 'HH:mm:ss'
        : "yyyy-MM-dd'T'HH:mm:ss";
    let millis = date.getMilliseconds();
    if (millis) {
      resultFormat += '.';
      while (millis % 10 === 0) {
        millis /= 10;
      }
      resultFormat += 'S'.repeat(millis.toString().length);
    }
    if (date.timeZone) {
      resultFormat += 'XXX';
      value = format(date, resultFormat, {
        in: tz(date.timeZone as string),
      });
    } else {
      value = format(date, resultFormat);
    }
    return value;
  }

  /**
   * Check if value should be considered null based on the column description.
   * @param value - string value to be checked
   * @param col - column description
   * @returns true if the value is null, false otherwise
   */
  private isValueNull(value: string, col: CsvwColumnDescription) {
    if (!col.null) return value === '';
    if (col.null === value) return true;
    if (Array.isArray(col.null)) {
      return col.null.some((nullVal) => nullVal === value);
    }
    return false;
  }

  /**
   * Handle whitespace normalization for the given value and datatype.
   * @param value - string value to be normalized
   * @param dtype - datatype URI
   * @param col - column description
   * @returns normalized value
   */
  private normalizeValue(
    value: string,
    dtype: string,
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg: CsvwTableGroupDescription | undefined
  ): string | string[] | null {
    if (!CSVW2RDFConvertor.normalizeWsTypes.has(dtype)) {
      value = value.replace(/\s+/, ' ').trim();
    } else if (dtype === xsd + 'normalizedString') {
      value = value.replace(/\t\r\n/g, ' ');
    }
    if (value === '') value = col.default ?? '';
    const sep = this.inherit('separator', col, table.tableSchema, table, tg);
    if (sep !== undefined) {
      if (value === '') return [];
      if (this.isValueNull(value, col)) return null;
      const parts = value.split(sep);
      if (dtype !== xsd + 'string' && dtype !== xsd + 'anyAtomicType') {
        return parts.map((part) => part.trim());
      }
      return parts;
    }
    return value;
  }
  private static dtUris: Record<CsvwBuiltinDatatype, string> = {
    any: xsd + 'anyAtomicType',
    anyAtomicType: xsd + 'anyAtomicType',
    anyURI: xsd + 'anyURI',
    base64Binary: xsd + 'base64Binary',
    binary: xsd + 'base64Binary',
    boolean: xsd + 'boolean',
    byte: xsd + 'byte',
    date: xsd + 'date',
    datetime: xsd + 'dateTime',
    dateTime: xsd + 'dateTime',
    dateTimeStamp: xsd + 'dateTimeStamp',
    dayTimeDuration: xsd + 'dayTimeDuration',
    decimal: xsd + 'decimal',
    double: xsd + 'double',
    duration: xsd + 'duration',
    float: xsd + 'float',
    gDay: xsd + 'gDay',
    gMonth: xsd + 'gMonth',
    gMonthDay: xsd + 'gMonthDay',
    gYear: xsd + 'gYear',
    gYearMonth: xsd + 'gYearMonth',
    hexBinary: xsd + 'hexBinary',
    html: rdf + 'HTML',
    int: xsd + 'int',
    integer: xsd + 'integer',
    json: csvw + 'JSON',
    language: xsd + 'language',
    long: xsd + 'long',
    Name: xsd + 'Name',
    negativeInteger: xsd + 'negativeInteger',
    NMTOKEN: xsd + 'NMTOKEN',
    nonNegativeInteger: xsd + 'nonNegativeInteger',
    nonPositiveInteger: xsd + 'nonPositiveInteger',
    normalizedString: xsd + 'normalizedString',
    number: xsd + 'double',
    positiveInteger: xsd + 'positiveInteger',
    QName: xsd + 'QName',
    short: xsd + 'short',
    string: xsd + 'string',
    time: xsd + 'time',
    token: xsd + 'token',
    unsignedByte: xsd + 'unsignedByte',
    unsignedInt: xsd + 'unsignedInt',
    unsignedLong: xsd + 'unsignedLong',
    unsignedShort: xsd + 'unsignedShort',
    xml: rdf + 'XMLLiteral',
    yearMonthDuration: xsd + 'yearMonthDuration',
  };
  private static normalizeWsTypes = new Set([
    xsd + 'string',
    xsd + 'normalizedString',
    CSVW2RDFConvertor.dtUris.xml,
    CSVW2RDFConvertor.dtUris.html,
    CSVW2RDFConvertor.dtUris.json,
    xsd + 'anyAtomicType',
  ]);

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
      resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveJsonldFn,
      resolveCsvStreamFn: options.resolveCsvStreamFn ?? defaultResolveStreamFn,
      resolveWkfFn: options.resolveWkfFn ?? defaultResolveTextFn,
      baseIRI: options.baseIRI ?? '',
      templateIRIs: options.templateIRIs ?? false,
      minimal: options.minimal ?? false,
    };
  }

  /**
   * Expands an IRI based on the common prefixes.
   * @param iri - IRI to be expanded
   * @returns Expanded IRI
   */
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

  /**
   * Expands a template URI.
   * @param template - Template to be expanded
   * @param col - Column number
   * @param srcCol - Source column number
   * @param row - Row number
   * @param srcRow - Source row number
   * @param colName - Column name
   * @param colVals - Column values
   * @param baseIRI - Base IRI
   * @returns Expanded URI node
   */
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
    uri = URL.parse(uri)?.href ?? baseIRI + uri;
    if (this.options.templateIRIs) {
      uri = decodeURI(uri);
    }
    return namedNode(uri);
  }
}
