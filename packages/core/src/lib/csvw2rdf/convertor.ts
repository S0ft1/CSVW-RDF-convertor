import { Csvw2RdfOptions, LogLevel } from '../conversion-options.js';
import { CSVParser } from '../csv-parser.js';
import {
  DescriptorWrapper,
  normalizeDescriptor,
} from '../descriptor.js';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
} from '../req-resolve.js';
import { coerceArray } from '../utils/coerce.js';
import {
  commonPrefixes,
  dateTypes,
  dtUris,
  invalidValuePrefix,
  numericTypes,
} from '../utils/prefix.js';
import { CsvwColumnDescription } from '../types/descriptor/column-description.js';
import {
  CsvwDatatype,
  CsvwNumberFormat,
} from '../types/descriptor/datatype.js';
import { CsvwDialectDescription } from '../types/descriptor/dialect-description.js';
import { CsvwTableGroupDescription } from '../types/descriptor/table-group.js';
import { CsvwTableDescription } from '../types/descriptor/table.js';
import { tz } from '@date-fns/tz';
import { Quad, Stream } from '@rdfjs/types';
import { format } from 'date-fns';
import * as uts46 from 'idna-uts46-hx';
import { BlankNode, DataFactory, Literal, NamedNode } from 'n3';
import { Readable } from 'readable-stream';
import { parseTemplate, Template } from 'url-template';
import { AnyCsvwDescriptor } from '../types/descriptor/descriptor.js';
import { CsvLocationTracker } from '../utils/code-location.js';
import { IssueTracker } from '../utils/issue-tracker.js';
import { parseDate } from '../utils/parse-date.js';
import { NumberParser } from '../utils/parse-number.js';
import { replaceUrl } from '../utils/replace-url.js';
import { validateTableGroup } from '../validation/table-group.js';
import { validateTable } from '../validation/table.js';

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;
const { rdf, csvw, xsd } = commonPrefixes;

interface Templates {
  about: Record<string, Template>;
  property: Record<string, Template>;
  value: Record<string, Template>;
}

interface TableContext {
  table: CsvwTableDescription;
  dialect: CsvwDialectDescription;
  columns: CsvwColumnDescription[];
  templates: Templates;
  row: string[];
  rowRecord: Record<string, string | string[] | null>;
  col: CsvwColumnDescription;
}

/**
 * Class responsible for converting from CSVW to RDF. This class should not be used in parallel.
 */
export class Csvw2RdfConvertor {
  private options: Required<Csvw2RdfOptions>;
  private location = new CsvLocationTracker();
  private outputStream: Readable = this.createOutputStream();
  public issueTracker = new IssueTracker(this.location, {
    eventEmitter: this.outputStream,
    collectIssues: false,
  });
  private numberParser = new NumberParser(this.issueTracker);
  private used = false;
  private input: DescriptorWrapper;

  private static defaultWKs = [
    parseTemplate('{+url}-metadata.json'),
    parseTemplate('csv-metadata.json'),
  ];
  private static normalizeWsTypes = new Set([
    xsd + 'string',
    xsd + 'normalizedString',
    dtUris.xml,
    dtUris.html,
    dtUris.json,
    xsd + 'anyAtomicType',
  ]);

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
  public convert(
    descriptor: string | AnyCsvwDescriptor,
    originalUrl?: string
  ): Stream<Quad> {
    if (this.used) {
      throw new Error('Csvw2RdfConvertor can be used only once');
    }
    this.used = true;
    normalizeDescriptor(
      descriptor,
      this.options,
      this.issueTracker,
      originalUrl
    )
      .then((input) => {
        this.input = input;
        return this.convertInner();
      })
      .catch((err) => {
        this.outputStream.destroy(err);
      });

    return this.outputStream;
  }

  private createOutputStream(): Readable {
    const outputStream = new Readable({
      objectMode: true,
      read() {
        // no-op
      },
    });
    return outputStream;
  }

  /**
   * Convert CSVW to RDF from a CSV file URL. The descriptor will be resolved according to
   * {@link https://www.w3.org/TR/2015/REC-tabular-data-model-20151217/#locating-metadata}.
   * see {@link https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf} for more information.
   * @param url url of the CSV file
   * @returns RDF stream
   */
  public convertFromCsvUrl(url: string): Stream<Quad> {
    if (this.used) {
      throw new Error('Csvw2RdfConvertor can be used only once');
    }
    this.used = true;
    this.resolveMetadata(url)
      .then(([wrapper, resolvedUrl]) => {
        this.options.baseIri = resolvedUrl;
        const tablesWithoutUrl = Array.from(wrapper.getTables()).filter(
          (table) => !table.url
        );
        if (tablesWithoutUrl.length > 1) {
          this.issueTracker.addError(
            'Multiple tables without URL found in the descriptor'
          );
        }
        if (tablesWithoutUrl.length === 1) {
          tablesWithoutUrl[0].url = url;
        }
        this.input = wrapper;
        return this.convertInner();
      })
      .catch((err) => {
        this.outputStream.destroy(err);
      });
    return this.outputStream;
  }

  private convertInner(): Promise<void> {
    if (!this.options.baseIri) {
      this.options.baseIri = this.input.descriptor['@id'] ?? '';
    }

    if (this.input.isTableGroup) {
      validateTableGroup(this.input.descriptor as CsvwTableGroupDescription, {
        input: this.input,
        issueTracker: this.issueTracker,
      });
    } else {
      validateTable(this.input.descriptor as CsvwTableDescription, {
        input: this.input,
        issueTracker: this.issueTracker,
      });
    }

    // 1
    const groupNode = this.createNode(
      this.input.isTableGroup ? this.input.descriptor : {}
    );
    if (!this.options.minimal) {
      //2
      this.emitTriple(
        groupNode,
        namedNode(rdf + 'type'),
        namedNode(csvw + 'TableGroup')
      );
      //3
      if (this.input.isTableGroup) {
        this.emitExternalProps(this.input.descriptor, groupNode);
      }
    }

    //4
    const tablePromises: Promise<void>[] = [];
    for (const table of this.input.getTables()) {
      if (table.suppressOutput) continue;
      tablePromises.push(
        this.convertTable({ table } as TableContext).then((tableNode) => {
          // 4.2
          if (!this.options.minimal) {
            this.emitTriple(groupNode, namedNode(csvw + 'table'), tableNode);
          }
        })
      );
    }

    return Promise.all(tablePromises).then(() => {
      this.outputStream.push(null);
    });
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
    expandedUrl = new URL(expandedUrl, this.options.baseIri || expandedUrl)
      .href;

    // metadata in a document linked to using a Link header associated with the tabular data file.
    let result = await this.verifyMetadataUrl(expandedUrl, expandedUrl);
    if (result) return result;

    // metadata located through default paths which may be overridden by a site-wide location configuration.
    const cleanUrl = new URL(expandedUrl);
    cleanUrl.hash = '';

    for (const template of await this.getWellKnownUris(expandedUrl)) {
      let resolvedUrl = new URL(
        template.expand({ url: cleanUrl.href }),
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
          'rdfs:comment': [], // TODO: remove?
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
        this.options.baseIri
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
      const text = await this.options.resolveWkfFn(url, this.options.baseIri);
      if (!text) return Csvw2RdfConvertor.defaultWKs;
      return text
        .split('\n')
        .filter((template) => template.trim())
        .map((template: string) => parseTemplate(template.trim()));
    } catch {
      return Csvw2RdfConvertor.defaultWKs;
    }
  }

  /**
   * Converts a table to RDF.
   */
  private async convertTable(ctx: TableContext) {
    this.location.update({ table: ctx.table.url });
    ctx.dialect = ctx.table.dialect ?? this.input.descriptor.dialect ?? {};

    //4.1
    const tableNode = this.createNode(ctx.table);
    //4.2 is done in the caller

    if (!this.options.minimal) {
      //4.2 is done in the caller
      //4.3
      this.emitTriple(
        tableNode,
        namedNode(rdf + 'type'),
        namedNode(csvw + 'Table')
      );
      //4.4
      this.emitTriple(
        tableNode,
        namedNode(csvw + 'url'),
        namedNode(ctx.table.url)
      );
      //4.5
      this.emitExternalProps(ctx.table, tableNode);
    }
    //4.6
    let rowNum = 0;
    const csvStream = (
      await this.options.resolveCsvStreamFn(ctx.table.url, this.options.baseIri)
    ).pipeThrough(new CSVParser(ctx.dialect));
    const iter = csvStream[Symbol.asyncIterator]();
    const maybeRow1 = await this.processCsvHeader(iter, ctx);
    this.prepareTemplates(ctx);
    const rowsOffset = this.getSrcRowsOffset(ctx);

    if (maybeRow1) {
      ctx.row = maybeRow1;
      const rowNode = this.convertTableRow(++rowNum, rowsOffset, ctx);
      if (!this.options.minimal) {
        this.emitTriple(tableNode, namedNode(csvw + 'row'), rowNode);
      }
    }
    for await (const row of iter) {
      ctx.row = row;
      const rowNode = this.convertTableRow(++rowNum, rowsOffset, ctx);
      if (!this.options.minimal) {
        this.emitTriple(tableNode, namedNode(csvw + 'row'), rowNode);
      }
    }
    return tableNode;
  }
  private getSrcRowsOffset(ctx: TableContext): number {
    const headerRows =
      ctx.dialect.headerRowCount ?? ((ctx.dialect.header ?? true) ? 1 : 0);
    return headerRows + (ctx.dialect.skipRows ?? 0);
  }

  /**
   * Prepares URI templates for the conversion.
   */
  private prepareTemplates(ctx: TableContext): void {
    const templates: Templates = {
      about: {},
      property: {},
      value: {},
    };
    const types = ['about', 'property', 'value'] as const;
    for (const col of ctx.columns) {
      if (col.suppressOutput) continue;
      ctx.col = col;
      for (const type of types) {
        const template = this.input.getInheritedProp(`${type}Url`, ctx.table, ctx.col);
        if (template === undefined) continue;
        templates[type][col.name as string] = parseTemplate(template);
      }
    }

    ctx.templates = templates;
  }

  /**
   * Processes the header of a CSV file and its embedded metadata.
   * @param {AsyncIterator<string[]>} stream  - Input stream
   * @returns The first row of the current table if there is no header and there are no columns defined in the table schema.
   * This row is used to determine the column count and must be passed to the {@link Csvw2RdfConvertor#convertTableRow} method.
   */
  private async processCsvHeader(
    stream: AsyncIterator<string[]>,
    ctx: TableContext
  ): Promise<string[] | undefined> {
    const defaultLang =
      this.input.getInheritedProp('lang', ctx.table) ??
      (this.input.descriptor['@context']?.[1] as any)?.['@language'] ??
      '@none';
    if (ctx.table.tableSchema === undefined) ctx.table.tableSchema = {};
    const schema = ctx.table.tableSchema;

    const headerRowCount =
      ctx.dialect.headerRowCount ?? ((ctx.dialect.header ?? true) ? 1 : 0);
    if (!schema.columns) {
      schema.columns = [];
    }
    ctx.columns = schema.columns;
    const physicalColCount = ctx.columns.length
      ? ctx.columns.filter((c) => !c.virtual).length
      : undefined;
    if (
      physicalColCount !== undefined &&
      ctx.columns.slice(0, physicalColCount).find((c) => c.virtual)
    ) {
      this.issueTracker.addError(
        'Table schema has virtual columns before physical ones'
      );
      ctx.columns.sort((a, b) => (a.virtual ? 1 : 0) - (b.virtual ? 1 : 0));
    }

    const maybeRow = await this.processMicrosyntax(
      defaultLang,
      headerRowCount,
      physicalColCount,
      stream,
      ctx
    );
    if (maybeRow) return maybeRow;
    this.columnTitlesToNames(defaultLang, ctx);

    this.validateDuplicateColumns(
      ctx.columns.filter((col) => col.name !== undefined)
    );
    return undefined;
  }

  /**
   * Processes the microsyntax of the CSV file. This currently includes only column titles.
   * @param defaultLang default language of the csv file
   * @param headerRowCount number of header rows
   * @param physicalColCount number of nonvirtual columns defined in the table schema or undefined if the table schema has no columns defined
   * @param stream CSV stream
   */
  private async processMicrosyntax(
    defaultLang: string,
    headerRowCount: number,
    physicalColCount: number | undefined,
    stream: AsyncIterator<string[]>,
    ctx: TableContext
  ): Promise<string[] | undefined> {
    for (const col of ctx.columns) {
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
        this.issueTracker.addError('CSV stream ended before header was read');
        return;
      }
      const vals = header.value.slice(ctx.dialect.skipColumns ?? 0);
      if (physicalColCount !== undefined && vals.length !== physicalColCount) {
        this.issueTracker.addWarning(
          `Header row ${i} has ${vals.length} columns, but the table schema has ${physicalColCount} non-virtual columns`
        );
      }
      this.headerRowToTitles(vals, defaultLang, i === 0, ctx);
    }

    if (!ctx.columns.length) {
      const row = await stream.next();
      if (row.done) return;
      ctx.columns = (
        ctx.table.tableSchema as { columns: CsvwColumnDescription[] }
      ).columns = row.value.map((_, i) => ({
        name: '_col.' + (i + 1),
      }));
      return row.value;
    }
    return undefined;
  }

  private headerRowToTitles(
    vals: string[],
    defaultLang: string,
    firstRow: boolean,
    ctx: TableContext
  ): void {
    for (let j = 0; j < vals.length; ++j) {
      if (!vals[j]) continue;
      let modified = false;
      let col = ctx.columns[j];
      if (!col) {
        col = {};
        ctx.columns[j] = col;
      }
      if (col.titles === undefined) col.titles = [vals[j]];
      else if (Array.isArray(col.titles)) {
        if (col.titles.includes(vals[j])) return;
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

      if (modified && firstRow) {
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

  private columnTitlesToNames(defaultLang: string, ctx: TableContext): void {
    for (let i = 0; i < ctx.columns.length; ++i) {
      const col = ctx.columns[i];
      if (col.name) continue;
      if (!col.titles) {
        col.name = '_col.' + (i + 1);
        continue;
      }
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
  }

  private validateDuplicateColumns(columns: CsvwColumnDescription[]): void {
    for (let i = 0; i < columns.length; ++i) {
      for (let j = 0; j < i; ++j) {
        if (columns[i].name === columns[j].name) {
          this.issueTracker.addError(
            `Duplicate column name "${columns[i].name}"`
          );
        }
      }
    }
  }

  /**
   * Converts table row to RDF by row number.
   * @param {number} rowNum - The row number.
   * @param {number} rowsOffset - The offset of the rows.
   */
  private convertTableRow(
    rowNum: number,
    rowsOffset: number,
    ctx: TableContext
  ): BlankNode {
    this.location.update({ row: rowNum });

    //4.6.1
    const rowNode: BlankNode = blankNode();
    //4.6.2 done by caller

    if (!this.options.minimal) {
      //4.6.3
      this.emitTriple(
        rowNode,
        namedNode(rdf + 'type'),
        namedNode(csvw + 'Row')
      );
      //4.6.4
      this.emitTriple(
        rowNode,
        namedNode(csvw + 'rownum'),
        literal(rowNum.toString(), namedNode(xsd + 'integer'))
      );
      //4.6.5
      this.emitTriple(
        rowNode,
        namedNode(csvw + 'url'),
        namedNode(ctx.table.url + '#row=' + (rowNum + rowsOffset))
      );

      //4.6.7
      // implementation dependent, based on notes on the table, we skip this
    }

    this.convertTableRowValues(rowNode, rowsOffset, ctx);

    if (!this.options.minimal) {
      //4.6.6
      const titles = coerceArray(ctx.table.tableSchema?.rowTitles);
      const titlemap: Record<string, number> = {};
      for (let i = 0; i < titles.length; i++) {
        titlemap[ctx.columns[i].name as string] = i;
      }

      for (const title of titles) {
        ctx.col = ctx.columns[titlemap[title]];
        const lang = this.input.getInheritedProp('lang', ctx.table, ctx.col);
        const val = ctx.rowRecord[title];
        if (!val) continue;
        this.emitTriple(
          rowNode,
          namedNode(csvw + 'title'),
          literal(val as string, lang)
        );
      }
    }

    return rowNode;
  }

  /**
   * Converts the values of a table row to RDF.
   */
  private convertTableRowValues(
    rowNode: BlankNode,
    rowsOffset: number,
    ctx: TableContext
  ): void {
    const colsOffset = ctx.dialect.skipColumns ?? 0;

    //4.6.8
    const defaultCellSubj = blankNode();
    const totalCols = Math.max(ctx.columns.length, ctx.row.length);
    ctx.rowRecord = {};

    // fill rowRecord (we need all of the row values to process template uris)
    for (let i = 0; i < totalCols; ++i) {
      ctx.col = ctx.columns[i];
      this.location.update({ column: i });
      const [dtUri, dt] = this.normalizeDatatype(ctx);

      ctx.rowRecord[ctx.col.name as string] = this.interpretDatatype(
        ctx.row[i],
        dtUri,
        dt,
        ctx
      );
    }

    // now we can safely process the values
    for (let i = 0; i < totalCols; ++i) {
      ctx.col = ctx.columns[i];
      if (ctx.col.suppressOutput) continue;

      this.convertRowCell(
        defaultCellSubj,
        rowNode,
        i,
        rowsOffset,
        colsOffset,
        ctx
      );
    }
  }

  /**
   * Converts a cell of the current row to RDF.
   * @param {BlankNode} defaultSubj - Default subject
   * @param {BlankNode} rowNode - The row node
   * @param {number} colNum - The column number.
   * @param {number} rowsOffset - The offset of the rows.
   * @param {number} colsOffset - The offset of the columns.
   */
  private convertRowCell(
    defaultSubj: BlankNode,
    rowNode: BlankNode,
    colNum: number,
    rowsOffset: number,
    colsOffset: number,
    ctx: TableContext
  ): void {
    this.location.update({ column: colNum });

    if (ctx.rowRecord[ctx.col.name as string] === null) {
      if (ctx.col.required) {
        this.issueTracker.addWarning('Null value in a required column');
      }
      return;
    }

    const [dtUri] = this.normalizeDatatype(ctx);
    const rowNum = this.location.value.row as number;

    //4.6.8.1
    const subject =
      ctx.templates.about[ctx.col.name as string] === undefined
        ? defaultSubj
        : this.templateUri(
            ctx.templates.about[ctx.col.name as string],
            colNum + colsOffset,
            rowNum + rowsOffset,
            ctx.table.url,
            ctx
          );
    if (!this.options.minimal) {
      //4.6.8.2
      this.emitTriple(rowNode, namedNode(csvw + 'describes'), subject);
    }
    const predicate =
      ctx.templates.property[ctx.col.name as string] === undefined
        ? namedNode(ctx.table.url + '#' + ctx.col.name)
        : this.templateUri(
            ctx.templates.property[ctx.col.name as string],
            colNum + colsOffset,
            rowNum + rowsOffset,
            ctx.table.url,
            ctx
          );
    const lang = this.input.getInheritedProp('lang', ctx.table, ctx.col);

    if (ctx.templates.value[ctx.col.name as string] === undefined) {
      const val = ctx.rowRecord[ctx.col.name as string] as string | string[];
      if (Array.isArray(val)) {
        if (this.input.getInheritedProp('ordered', ctx.table, ctx.col)) {
          const head = this.createRDFList(
            val.map((v) => this.datatypeToLiteral(v, dtUri as string, lang))
          );
          this.emitTriple(subject, predicate, head);
        } else {
          for (const item of val) {
            this.emitTriple(
              subject,
              predicate,
              this.datatypeToLiteral(item, dtUri as string, lang)
            );
          }
        }
      } else {
        this.emitTriple(
          subject,
          predicate,
          this.datatypeToLiteral(val, dtUri as string, lang)
        );
      }
    } else {
      const val = this.templateUri(
        ctx.templates.value[ctx.col.name as string],
        colNum + colsOffset,
        rowNum + rowsOffset,
        ctx.table.url,
        ctx
      );
      this.emitTriple(subject, predicate, val);
    }
  }

  /**
   * Get expanded datatype URI and description for the current column.
   * @returns [datatype URI, datatype description]
   */
  private normalizeDatatype(ctx: TableContext): [string, CsvwDatatype] {
    const dtOrBuiltin =
      this.input.getInheritedProp('datatype', ctx.table, ctx.col) ?? 'string';
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
    return [dtUri, dt];
  }

  /**
   * Creates an RDF list https://ontola.io/blog/ordered-data-in-rdf based on rules provided at https://w3c.github.io/csvw/csv2rdf/#json-ld-to-rdf.
   * @param values  - Values of the list
   * @returns The head of the rdf list
   */
  private createRDFList(values: (NamedNode | Literal)[]): BlankNode {
    const head = blankNode();
    let current = head;

    for (let i = 0; i < values.length - 1; ++i) {
      this.emitTriple(current, namedNode(rdf + 'first'), values[i]);
      const next = blankNode();
      this.emitTriple(current, namedNode(rdf + 'rest'), next);
      current = next;
    }

    this.emitTriple(
      current,
      namedNode(rdf + 'first'),
      values[values.length - 1]
    );
    this.emitTriple(current, namedNode(rdf + 'rest'), namedNode(rdf + 'nil'));
    return head;
  }

  /**
   * Emits a triple to the output stream.
   */
  private emitTriple(
    first: NamedNode | BlankNode,
    second: NamedNode,
    third: NamedNode | BlankNode | Literal
  ): void {
    this.outputStream.push(quad(first, second, third, defaultGraph()));
  }

  private emitExternalProps(
    object: { notes?: unknown },
    node: BlankNode | NamedNode
  ): void {
    if (object.notes === undefined) return;
    for (const prop of this.input.getExternalProps(
      object.notes as string,
      node
    )) {
      this.outputStream.push(prop);
    }
  }

  /**
   * Creates a named node or a blank node based on the input.
   * @param input - Input object
   */
  private createNode(input: { '@id'?: string }): NamedNode | BlankNode {
    if (input['@id'] === undefined) {
      return blankNode();
    } else {
      return namedNode(input['@id']);
    }
  }

  /**
   * Inteprets the datatype of a value based on the current column description.
   * @param {string} value - string value to be interpreted
   * @returns Correctly built RDF literal
   */
  private interpretDatatype(
    value: string,
    dtUri: string,
    dt: CsvwDatatype,
    ctx: TableContext
  ): string | string[] | null {
    const normalizedValue = this.normalizeValue(value, dtUri, ctx);
    if (normalizedValue === null) return null;
    if (Array.isArray(normalizedValue)) {
      const formatted = normalizedValue
        .map((val) => this.reformatValue(val, dtUri as string, dt, ctx))
        .filter((val) => val !== null);
      return formatted;
    } else {
      const object = this.reformatValue(normalizedValue, dtUri, dt, ctx);
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
    if (dtUri === xsd + 'string' && lang) {
      return literal(value, lang);
    }

    return literal(value, namedNode(dtUri));
  }

  /**
   * Reformat string value into a valid string representation of the datatype.
   * @param value - string value to be converted
   * @param dtUri - datatype URI
   * @param dt - datatype description
   * @returns the reformatted value
   */
  private reformatValue(
    value: string,
    dtUri: string,
    dt: CsvwDatatype,
    ctx: TableContext
  ): string | null {
    if (value === '') value = ctx.col.default ?? '';
    if (this.isValueNull(value, ctx)) return null;

    if (numericTypes.has(dtUri)) {
      value = this.numberParser.parse(
        value,
        dt.format as CsvwNumberFormat,
        dtUri,
        dt
      );
    } else if (dateTypes.has(dtUri)) {
      value = this.reformatDate(value, dtUri, dt);
    } else if (dtUri === xsd + 'boolean') {
      value = this.reformatBoolean(value, dt);
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

    if (!this.validateValueLength(value, dtUri, dt)) {
      return invalidValuePrefix + value;
    }
    return value;
  }

  private validateValueLength(
    value: string,
    dtUri: string,
    dt: CsvwDatatype
  ): boolean {
    const valLength = this.getValueLength(value, dtUri);
    if (dt.length !== undefined && dt.length !== valLength) {
      this.issueTracker.addWarning(
        `Value "${value}" does not match the length "${dt.length}"`
      );
      return false;
    } else if (dt.minLength !== undefined && dt.minLength > valLength) {
      this.issueTracker.addWarning(
        `Value "${value}" does not match the minLength "${dt.minLength}"`
      );
      return false;
    } else if (dt.maxLength !== undefined && dt.maxLength < valLength) {
      this.issueTracker.addWarning(
        `Value "${value}" does not match the maxLength "${dt.maxLength}"`
      );
      return false;
    }
    return true;
  }

  private getValueLength(value: string, dtUri: string): number {
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

  private reformatBoolean(value: string, dt: CsvwDatatype): string {
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
    return value;
  }

  private reformatDate(value: string, dtUri: string, dt: CsvwDatatype): string {
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
   * Check if value should be considered null based on the current column description.
   * @param value - string value to be checked
   * @returns true if the value is null, false otherwise
   */
  private isValueNull(value: string, ctx: TableContext): boolean {
    const nullVal = this.input.getInheritedProp('null', ctx.table, ctx.col);
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
   * @returns normalized value
   */
  private normalizeValue(
    value: string,
    dtype: string,
    ctx: TableContext
  ): string | string[] | null {
    if (!Csvw2RdfConvertor.normalizeWsTypes.has(dtype)) {
      value = value.replace(/\s+/, ' ').trim();
    } else if (dtype === xsd + 'normalizedString') {
      value = value.replace(/\t\r\n/g, ' ');
    }
    if (value === '') value = ctx.col.default ?? '';
    const sep = this.input.getInheritedProp('separator', ctx.table, ctx.col);
    if (sep !== undefined) {
      if (value === '') return [];
      if (this.isValueNull(value, ctx)) return null;
      const parts = value.split(sep);
      if (dtype !== xsd + 'string' && dtype !== xsd + 'anyAtomicType') {
        return parts.map((part) => part.trim());
      }
      return parts;
    }
    return value;
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
      resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveJsonldFn,
      resolveCsvStreamFn: options.resolveCsvStreamFn ?? defaultResolveStreamFn,
      resolveWkfFn: options.resolveWkfFn ?? defaultResolveTextFn,
      baseIri: options.baseIri ?? '',
      templateIris: options.templateIris ?? false,
      minimal: options.minimal ?? false,
      logLevel: options.logLevel ?? LogLevel.Warn,
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
   * @param srcCol - Source column number ({@link Csvw2RdfConvertor#location} column + {@link CsvwDialectDescription#skipColumns})
   * @param srcRow - Source row number ({@link Csvw2RdfConvertor#location} row + {@link CsvwDialectDescription#headerRowCount} + {@link CsvwDialectDescription#skipRows})
   * @param colVals - Column values
   * @param baseIri - Base IRI
   * @returns Expanded URI node
   */
  private templateUri(
    template: Template,
    srcCol: number,
    srcRow: number,
    baseIri: string,
    ctx: TableContext
  ): NamedNode {
    let uri = template.expand({
      ...ctx.rowRecord,
      _column: this.location.value.column as number,
      _sourceColumn: srcCol,
      _row: this.location.value.row as number,
      _sourceRow: srcRow,
      _name: decodeURIComponent(ctx.col.name as string),
    });
    uri = this.expandIri(uri);
    uri = URL.parse(uri)?.href ?? baseIri + uri;
    if (this.options.templateIris) {
      const parsed = URL.parse(uri) as URL;
      uri = parsed.href.replace(
        parsed.hostname,
        uts46.toUnicode(parsed.hostname)
      );
      uri = decodeURI(uri);
    }
    return namedNode(uri);
  }
}
