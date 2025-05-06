import { DescriptorWrapper, normalizeDescriptor } from './descriptor.js';
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
  dtUris,
  invalidValuePrefix,
  numericTypes,
  XSD_TEMP,
  XSD_TEMP_PREFIX,
} from './utils/prefix.js';
import { coerceArray } from './utils/coerce.js';

import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { CsvwTableDescription } from './types/descriptor/table.js';
import { CsvwDatatype, CsvwNumberFormat } from './types/descriptor/datatype.js';
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
import { parseDate } from './utils/parse-date.js';
import { tz } from '@date-fns/tz';
import EventEmitter from 'node:events';
import { validateTableGroup } from './validation/table-group.js';
import { validateTable } from './validation/table.js';
import { IssueTracker } from './utils/issue-tracker.js';
import { CsvLocationTracker } from './utils/code-location.js';
import { NumberParser } from './utils/parse-number.js';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
const { rdf, csvw, xsd } = commonPrefixes;

interface Templates {
  about: Record<string, Template>;
  property: Record<string, Template>;
  value: Record<string, Template>;
}

/**
 * Class responsible for converting from CSVW to RDF. This class should not be used in parallel.
 */
export class Csvw2RdfConvertor {
  private options: Required<Csvw2RdfOptions>;
  private store: Quadstore;
  public issueTracker: IssueTracker;
  private location: CsvLocationTracker;
  private numberParser: NumberParser;

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
    this.location = new CsvLocationTracker();
    this.issueTracker = new IssueTracker(this.location);
    const wrapper = await normalizeDescriptor(
      descriptor,
      this.options,
      this.issueTracker,
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
    this.location = new CsvLocationTracker();
    this.issueTracker = new IssueTracker(this.location);
    const [wrapper, resolvedUrl] = await this.resolveMetadata(url);
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

  private async convertInner(input: DescriptorWrapper): Promise<Stream<Quad>> {
    this.numberParser = new NumberParser(this.issueTracker);
    await this.openStore();
    if (!this.options.baseIRI) {
      this.options.baseIRI = input.descriptor['@id'] ?? '';
    }

    if (input.isTableGroup) {
      validateTableGroup(input.descriptor as CsvwTableGroupDescription, {
        input,
        issueTracker: this.issueTracker,
      });
    } else {
      validateTable(input.descriptor as CsvwTableDescription, {
        input,
        issueTracker: this.issueTracker,
      });
    }

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
  ): Promise<[DescriptorWrapper, string]> {
    let expandedUrl = replaceUrl(csvUrl, this.options.pathOverrides);
    expandedUrl = new URL(expandedUrl, this.options.baseIRI || expandedUrl)
      .href;

    // metadata in a document linked to using a Link header associated with the tabular data file.
    let result = await this.verifyMetadataUrl(expandedUrl, expandedUrl);
    if (result) return result;

    // metadata located through default paths which may be overridden by a site-wide location configuration.
    const cleanUrl = new URL(expandedUrl);
    cleanUrl.hash = '';

    for (const template of await this.getWellKnownUris(expandedUrl)) {
      let resolvedUrl = new URL(
        template.expand({ url: cleanUrl.toString() }),
        expandedUrl
      ).href;
      resolvedUrl = replaceUrl(resolvedUrl, this.options.pathOverrides);
      result = await this.verifyMetadataUrl(resolvedUrl, expandedUrl);
      if (result) return result;
    }

    return [
      await normalizeDescriptor(
        {
          '@context': 'http://www.w3.org/ns/csvw',
          'rdfs:comment': [],
          tableSchema: {
            columns: [],
          },
          url: csvUrl.split('/').pop() as string,
        },
        this.options,
        this.issueTracker,
        expandedUrl
      ),
      expandedUrl,
    ];
  }

  /**
   * Verify that the metadata URL is valid and contains a table description that matches the CSV file.
   * @param url url to the descriptor
   * @param csvUrl url to the CSV file
   * @returns either descriptor and url or null if the descriptor is not valid
   */
  private async verifyMetadataUrl(
    url: string,
    csvUrl: string
  ): Promise<[DescriptorWrapper, string] | null> {
    try {
      const descriptor = await this.options.resolveJsonldFn(
        url,
        this.options.baseIRI
      );
      const wrapper = await normalizeDescriptor(
        JSON.parse(descriptor),
        this.options,
        this.issueTracker,
        url
      );
      for (const t of wrapper.getTables()) {
        let expandedUrl = replaceUrl(t.url ?? '', this.options.pathOverrides);
        expandedUrl = new URL(expandedUrl, url).href;
        if (!t.url || expandedUrl === csvUrl) {
          return [wrapper, url];
        }
      }
      this.issueTracker.addWarning(
        `Metadata file ${url} does not contain a table that matches the CSV file ${csvUrl}`
      );
    } catch {
      // ignore errors
    }
    return null;
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
      if (!text) return Csvw2RdfConvertor.defaultWKs;
      return text
        .split('\n')
        .filter((template) => template.trim())
        .map((template: string) => parseTemplate(template.trim()));
    } catch {
      return Csvw2RdfConvertor.defaultWKs;
    }
  }
  private static defaultWKs = [
    parseTemplate('{+url}-metadata.json'),
    parseTemplate('csv-metadata.json'),
  ];

  /**
   * Creates and opens a new quadstore in the current instance of Csvw2RdfConvertor.
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
    this.location.update({ table: table.url });

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
   * This row is used to determine the column count and must be passed to the {@link Csvw2RdfConvertor#convertTableRow} method.
   */
  private async processCsvHeader(
    stream: AsyncIterator<string[]>,
    table: CsvwTableDescription,
    dialect: CsvwDialectDescription,
    input: DescriptorWrapper
  ): Promise<string[] | undefined> {
    const defaultLang =
      this.inherit('lang', table, input.descriptor) ??
      (input.descriptor['@context']?.[1] as any)?.['@language'] ??
      '@none';

    const headerRowCount =
      dialect.headerRowCount ?? (dialect.header ?? true ? 1 : 0);
    if (table.tableSchema === undefined) table.tableSchema = {};
    const nonvirtualColCount =
      (table.tableSchema.columns?.length || undefined) &&
      table.tableSchema.columns?.filter((c) => !c.virtual).length;
    if (table.tableSchema.columns === undefined) table.tableSchema.columns = [];

    for (const col of table.tableSchema.columns) {
      if (
        col.titles &&
        typeof col.titles === 'object' &&
        !Array.isArray(col.titles) &&
        '@none' in col.titles &&
        !(defaultLang in col.titles)
      ) {
        col.titles[defaultLang] = col.titles['@none'];
        delete col.titles['@none'];
      }
    }

    for (let i = 0; i < headerRowCount; ++i) {
      const header = await stream.next();
      if (header.done) {
        throw new Error('CSV stream ended before header was read');
      }
      const vals = header.value.slice(dialect.skipColumns ?? 0);
      if (
        nonvirtualColCount !== undefined &&
        vals.length !== nonvirtualColCount
      ) {
        this.issueTracker.addWarning(
          `Header row ${i} has ${vals.length} columns, but the table schema has ${nonvirtualColCount} non-virtual columns`
        );
      }

      for (let j = 0; j < vals.length; ++j) {
        if (!vals[j]) continue;
        let modified = false;
        let col = table.tableSchema.columns[j];
        if (!col) {
          col = {};
          table.tableSchema.columns[j] = col;
        }
        if (col.titles === undefined) col.titles = [vals[j]];
        else if (Array.isArray(col.titles)) {
          if (col.titles.includes(vals[j])) continue;
          col.titles.push(vals[j]);
          modified = true;
        } else if (typeof col.titles === 'string') {
          if (col.titles !== vals[j]) {
            col.titles = [col.titles, vals[j]];
            modified = true;
          }
        } else if (col.titles[defaultLang] === undefined) {
          col.titles[defaultLang] = vals[j];
          modified = Object.keys(col.titles).length > 1;
        } else if (typeof col.titles[defaultLang] === 'string') {
          if (col.titles[defaultLang] !== vals[j]) {
            col.titles[defaultLang] = [col.titles[defaultLang], vals[j]];
            modified = true;
          }
        } else if (!col.titles[defaultLang].includes(vals[j])) {
          col.titles[defaultLang].push(vals[j]);
          modified = true;
        }

        if (modified && i === 0) {
          const title = coerceArray(
            typeof col.titles === 'object' && !Array.isArray(col.titles)
              ? col.titles[defaultLang]
              : col.titles
          )[0];
          if (title === vals[j]) {
            this.issueTracker.addWarning(
              `Column title language is different from header in the CSV file "${vals[j]}"@${defaultLang}`
            );
          } else {
            this.issueTracker.addWarning(
              `Column title "${title}" is different from header in the CSV file "${vals[j]}"`
            );
          }
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
    this.location.update({ row: rowNum });

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
      this.location.update({ column: i });
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
      if (col.suppressOutput) continue;

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
    this.location.update({ column: colNum });

    if (values[col.name as string] === null) {
      if (col.required) {
        this.issueTracker.addWarning('Null value in a required column');
      }
      return;
    }

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
      const val = values[col.name as string] as string | string[];
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
      if (dt.base in dtUris) {
        dtUri = dtUris[dt.base];
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
        .map((val) =>
          this.formatValue(val, dtUri as string, dt, col, table, tg)
        )
        .filter((val) => val !== null);
      return formatted;
    } else {
      const object = this.formatValue(
        normalizedValue,
        dtUri,
        dt,
        col,
        table,
        tg
      );
      return object;
    }
  }

  /**
   * Convert string value to RDF literal based on the datatype URI.
   * Quadstore cannot store NaN as a literal, so we use a temporary prefix for numeric types.
   * This is later replaced in the {@link Csvw2RdfConvertor#replacerStream} method.
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
    if (dtUri !== xsd + 'string' && value.startsWith(invalidValuePrefix)) {
      return literal(
        value.slice(invalidValuePrefix.length),
        namedNode(xsd + 'string')
      );
    }
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
   * @param table - table description
   * @param tg - table group description
   * @returns the formatted value
   */
  private formatValue(
    value: string,
    dtUri: string,
    dt: CsvwDatatype,
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg?: CsvwTableGroupDescription
  ): string | null {
    if (value === '') value = col.default ?? '';
    if (this.isValueNull(value, col, table, tg)) return null;

    if (numericTypes.has(dtUri)) {
      value = this.numberParser.parse(
        value,
        dt.format as CsvwNumberFormat,
        dtUri,
        dt
      );
    } else if (dateTypes.has(dtUri)) {
      value = this.formatDate(value, dtUri, dt);
    } else if (dtUri === xsd + 'boolean') {
      if (dt.format) {
        const [trueVal, falseVal] = (dt.format as string).split('|');
        if (value === trueVal) value = 'true';
        else if (value === falseVal) value = 'false';
        else {
          this.issueTracker.addWarning(
            `Value "${value}" does not match the format "${dt.format}"`
          );
          return invalidValuePrefix + value;
        }
      } else {
        if (value === 'true' || value === '1') value = 'true';
        else if (value === 'false' || value === '0') value = 'false';
        else {
          this.issueTracker.addWarning(
            `Value "${value}" does not match the format "true|false" or "1|0"`
          );
          return invalidValuePrefix + value;
        }
      }
    } else if (
      dt.format instanceof RegExp &&
      dtUri !== csvw + 'json' &&
      dtUri !== xsd + 'xml' &&
      dtUri !== xsd + 'html'
    ) {
      if (!value.match(dt.format)) {
        this.issueTracker.addWarning(
          `Value "${value}" does not match the format "${dt.format}"`
        );
        if (dtUri !== xsd + 'string') {
          return invalidValuePrefix + value;
        }
      }
    }

    const valLength = this.getValueLength(value, dtUri);
    if (dt.length !== undefined && dt.length !== valLength) {
      this.issueTracker.addWarning(
        `Value "${value}" does not match the length "${dt.length}"`
      );
      return invalidValuePrefix + value;
    } else if (dt.minLength !== undefined && dt.minLength > valLength) {
      this.issueTracker.addWarning(
        `Value "${value}" does not match the minLength "${dt.minLength}"`
      );
      return invalidValuePrefix + value;
    } else if (dt.maxLength !== undefined && dt.maxLength < valLength) {
      this.issueTracker.addWarning(
        `Value "${value}" does not match the maxLength "${dt.maxLength}"`
      );
      return invalidValuePrefix + value;
    }

    return value;
  }

  private getValueLength(value: string, dtUri: string) {
    if (value === undefined) return 0;
    switch (dtUri) {
      case xsd + 'hexBinary':
        return value.length / 2;
      case xsd + 'base64Binary':
        return atob(value).length;
      default:
        return value.length;
    }
  }

  private formatDate(value: string, dtUri: string, dt: CsvwDatatype) {
    const date = parseDate(value, dtUri, dt.format as string);
    if (Number.isNaN(date.getTime())) {
      if (dt.format) {
        this.issueTracker.addWarning(
          `Value "${value}" does not match the format "${dt.format}"`
        );
      } else {
        this.issueTracker.addWarning(`Value "${value}" is not a valid date`);
      }
      return invalidValuePrefix + value;
    }

    if (!this.validateDateMinMax(date, dtUri, dt)) {
      return invalidValuePrefix + value;
    }

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

  private validateDateMinMax(
    value: Date,
    dtUri: string,
    dt: CsvwDatatype
  ): boolean {
    const minimum = dt.minimum ?? dt.minInclusive ?? undefined;
    const maximum = dt.maximum ?? dt.maxInclusive ?? undefined;
    const minExclusive = dt.minExclusive ?? undefined;
    const maxExclusive = dt.maxExclusive ?? undefined;

    if (minimum !== undefined && value < parseDate(minimum as string, dtUri)) {
      this.issueTracker.addWarning(
        `Value "${value}" does not meet the minimum "${minimum}"`
      );
      return false;
    }
    if (maximum !== undefined && value > parseDate(maximum as string, dtUri)) {
      this.issueTracker.addWarning(
        `Value "${value}" does not meet the maximum "${maximum}"`
      );
      return false;
    }
    if (
      minExclusive !== undefined &&
      value <= parseDate(minExclusive as string, dtUri)
    ) {
      this.issueTracker.addWarning(
        `Value "${value}" does not meet the minimum exclusive "${minExclusive}"`
      );
      return false;
    }
    if (
      maxExclusive !== undefined &&
      value >= parseDate(maxExclusive as string, dtUri)
    ) {
      this.issueTracker.addWarning(
        `Value "${value}" does not meet the maximum exclusive "${maxExclusive}"`
      );
      return false;
    }
    return true;
  }

  /**
   * Check if value should be considered null based on the column description.
   * @param value - string value to be checked
   * @param col - column description
   * @returns true if the value is null, false otherwise
   */
  private isValueNull(
    value: string,
    col: CsvwColumnDescription,
    table: CsvwTableDescription,
    tg?: CsvwTableGroupDescription
  ) {
    const nullVal = this.inherit('null', col, table.tableSchema, table, tg);
    if (nullVal === undefined) return value === '';
    if (nullVal === value) return true;
    if (Array.isArray(nullVal)) {
      return nullVal.some((n) => n === value);
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
    if (!Csvw2RdfConvertor.normalizeWsTypes.has(dtype)) {
      value = value.replace(/\s+/, ' ').trim();
    } else if (dtype === xsd + 'normalizedString') {
      value = value.replace(/\t\r\n/g, ' ');
    }
    if (value === '') value = col.default ?? '';
    const sep = this.inherit('separator', col, table.tableSchema, table, tg);
    if (sep !== undefined) {
      if (value === '') return [];
      if (this.isValueNull(value, col, table, tg)) return null;
      const parts = value.split(sep);
      if (dtype !== xsd + 'string' && dtype !== xsd + 'anyAtomicType') {
        return parts.map((part) => part.trim());
      }
      return parts;
    }
    return value;
  }
  private static normalizeWsTypes = new Set([
    xsd + 'string',
    xsd + 'normalizedString',
    dtUris.xml,
    dtUris.html,
    dtUris.json,
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
