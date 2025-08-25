import { LogLevel, Rdf2CsvOptions } from '../conversion-options.js';
import { DescriptorWrapper, normalizeDescriptor } from '../descriptor.js';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
} from '../req-resolve.js';
import { ColumnSchema } from './schema/column-schema.js';
import { TableGroupSchema } from './schema/table-group-schema.js';
import { transformStream } from './transformation-stream.js';

import { AnyCsvwDescriptor } from '../types/descriptor/descriptor.js';
import {
  CsvwTableDescription,
  CsvwTableDescriptionWithRequiredColumns,
} from '../types/descriptor/table.js';

import { CsvLocationTracker } from '../utils/code-location.js';
import { coerceArray } from '../utils/coerce.js';
import { commonPrefixes } from '../utils/prefix.js';
import { IssueTracker } from '../utils/issue-tracker.js';

import { MemoryLevel } from 'memory-level';
import { DataFactory, Quad, StreamParser } from 'n3';
import { Quadstore, StoreOpts } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { JsonLdParser } from 'jsonld-streaming-parser';
import { Bindings, ResultStream } from '@rdfjs/types';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { parseTemplate } from 'url-template';

// TODO: Can these types be improved for better readability and ease of use?
export type CsvwColumn = { name: string; title: string; queryVariable: string };
export type CsvwTableStreams = {
  [tableName: string]: [
    columns: CsvwColumn[],
    // XXX: ResultStream will be merged with Stream upon the next major change of rdf.js library
    rowsStream: ResultStream<Bindings>,
  ];
};

type OptionsWithDefaults = Required<Omit<Rdf2CsvOptions, 'descriptor'>> &
  Pick<Rdf2CsvOptions, 'descriptor'>;

export class Rdf2CsvwConvertor {
  private options: OptionsWithDefaults;
  private location = new CsvLocationTracker();
  public issueTracker = new IssueTracker(this.location, {
    collectIssues: false,
  });
  private store: Quadstore;
  private engine: Engine;
  /** Wrapper of the descriptor used in the last conversion */
  private wrapper: DescriptorWrapper;

  public getDescriptor(): DescriptorWrapper {
    return this.wrapper;
  }

  constructor(options?: Rdf2CsvOptions) {
    this.options = this.setDefaults(options);
  }

  /**
   * Main conversion function. Converts the rdf data to csvw format.
   * @param url Url of rdf data to convert
   * @param descriptor CSVW descriptor to use for the conversion. If not provided, a new descriptor will be created from the rdf data.
   * @returns A stream of csvw data.
   */
  public async convert(
    url: string,
    descriptor?: string | AnyCsvwDescriptor,
  ): Promise<CsvwTableStreams> {
    // TODO: What if we do not have enough memory to hold all the quads in the store?
    const readableStream = await this.options.resolveRdfStreamFn(
      url,
      this.options.baseIri,
    );
    let parser: StreamParser | JsonLdParser | RdfXmlParser;
    if (url.match(/\.(rdf|xml)([?#].*)?$/)) {
      parser = new RdfXmlParser();
    } else if (url.match(/\.jsonld([?#].*)?$/)) {
      parser = new JsonLdParser();
    } else {
      // TODO: By default, N3.Parser parses a permissive superset of Turtle, TriG, N-Triples, and N-Quads. For strict compatibility with any of those languages, pass a format argument upon creation.
      parser = new StreamParser<Quad>();
    }
    const useNamedGraphs = url.match(/\.(nq|trig)([?#].*)?$/) !== null;

    for await (const chunk of readableStream) {
      parser.write(chunk);
    }
    parser.end();

    await this.openStore();

    if (descriptor === undefined) {
      // TODO: return created descriptor to the user, so it can be saved, modified and used later
      this.wrapper = await this.createDescriptor(parser);
    } else {
      this.wrapper = await normalizeDescriptor(
        descriptor,
        this.options,
        this.issueTracker,
      );
      await this.store.putStream(parser);
    }

    // Now we have a descriptor either from user or from rdf data.
    const tables = this.wrapper.isTableGroup
      ? this.wrapper.getTables()
      : ([this.wrapper.descriptor] as CsvwTableDescription[]);
    const streams = {} as CsvwTableStreams;
    let openedStreamsCount = 0;

    for (const table of tables) {
      // TODO: use IssueTracker
      if (!table.tableSchema?.columns) {
        if (this.options.logLevel >= LogLevel.Warn)
          console.warn(
            `Skipping table ${table.url.replace(/[?#].*$/, '')}: no columns found`,
          );
        continue;
      }
      if (table.suppressOutput === true) {
        if (this.options.logLevel >= LogLevel.Warn)
          console.warn(
            `Skipping table ${table.url.replace(/[?#].*$/, '')}: suppressOutput set to true`,
          );
        continue;
      }

      const tableWithRequiredColumns =
        table as CsvwTableDescriptionWithRequiredColumns;

      // See https://w3c.github.io/csvw/metadata/#tables for jsonld descriptor specification
      // and https://www.w3.org/TR/csv2rdf/ for conversion in the other direction

      // TODO: rdf lists
      // TODO: skip columns
      // TODO: row number in url templates
      // TODO: detect cycles

      const [columns, query] = this.createQuery(
        tableWithRequiredColumns,
        useNamedGraphs,
      );
      if (this.options.logLevel >= LogLevel.Debug) console.debug(query);

      const stream = transformStream(
        // XXX: quadstore-comunica does not support unionDefaultGraph option of comunica, so UNION must be used manually in the query.
        await this.engine.queryBindings(query, { baseIRI: '.' }),
        tableWithRequiredColumns,
        columns,
        this.issueTracker,
      );
      openedStreamsCount++;
      streams[tableWithRequiredColumns.url.replace(/[?#].*$/, '')] = [
        columns.filter(
          (col, i) => !tableWithRequiredColumns.tableSchema.columns[i].virtual,
        ),
        stream,
      ];
    }
    for (const [, [, stream]] of Object.entries(streams)) {
      stream.once('end', () => {
        if (--openedStreamsCount === 0) this.store.close();
      });
    }
    return streams;
  }

  /**
   * Creates SPARQL query.
   * @param table CSV Table
   * @param columns Columns including virtual ones
   * @param useNamedGraphs Query from named graphs in the SPARQL query
   * @returns SPARQL query as a string
   */
  private createQuery(
    table: CsvwTableDescriptionWithRequiredColumns,
    useNamedGraphs: boolean,
  ): [CsvwColumn[], string] {
    let queryVarCounter = 0;
    const queryVars: Record<string, string> = {};

    const columns: CsvwColumn[] = table.tableSchema.columns.map((column, i) => {
      const defaultLang =
        (this.wrapper.descriptor['@context']?.[1] as any)?.['@language'] ??
        '@none';

      let name = `_col.${i + 1}`;
      if (column.name !== undefined) {
        name = encodeURIComponent(column.name);
      } else if (column.titles !== undefined) {
        if (typeof column.titles === 'string' || Array.isArray(column.titles)) {
          name = encodeURIComponent(coerceArray(column.titles)[0]);
        } else {
          // TODO: use else (startsWith(defaultLang)) as in core/src/lib/csvw2rdf/convertor.ts, or set inherited properties just away in normalizeDescriptor().
          if (defaultLang in column.titles) {
            name = encodeURIComponent(
              coerceArray(column.titles[defaultLang])[0],
            );
          }
        }
      }

      let title = undefined;
      if (column.titles !== undefined) {
        if (typeof column.titles === 'string' || Array.isArray(column.titles)) {
          title = coerceArray(column.titles)[0];
        } else {
          // TODO: use else (startsWith(defaultLang)) as in core/src/lib/csvw2rdf/convertor.ts, or set inherited properties just away in normalizeDescriptor().
          if (defaultLang in column.titles) {
            title = coerceArray(column.titles[defaultLang])[0];
          }
        }
      }
      if (title === undefined && column.name !== undefined) {
        title = column.name;
      }
      if (title === undefined) title = `_col.${i + 1}`;

      const aboutUrl = column.aboutUrl;
      const propertyUrl = column.propertyUrl;
      const valueUrl = column.valueUrl;

      if (queryVars[aboutUrl ?? ''] === undefined)
        queryVars[aboutUrl ?? ''] = `_${queryVarCounter++}`;
      if (valueUrl && queryVars[valueUrl] === undefined)
        queryVars[valueUrl] = `_${queryVarCounter++}`;

      let queryVar: string;
      if (
        propertyUrl &&
        this.expandIri(propertyUrl) ===
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      ) {
        queryVar = queryVars[aboutUrl ?? ''];
      } else {
        queryVar = valueUrl ? queryVars[valueUrl] : `_${queryVarCounter++}`;
      }

      return { name: name, title: title, queryVariable: queryVar };
    });

    const lines: string[] = [];
    let allOptional = true;
    const topLevel: number[] = [];
    for (let index = 0; index < table.tableSchema.columns.length; index++) {
      const column = table.tableSchema.columns[index];

      const aboutUrl = column.aboutUrl;
      const referencedBy = table.tableSchema.columns.find((col) => {
        if (
          col.propertyUrl &&
          this.expandIri(col.propertyUrl) ===
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
        )
          return col !== column && col.aboutUrl && col.aboutUrl === aboutUrl;
        else return col !== column && col.valueUrl && col.valueUrl === aboutUrl;
      });

      // TODO: use tableSchema.foreignKeys
      if (
        !referencedBy ||
        (table.tableSchema.primaryKey &&
          coerceArray(table.tableSchema.primaryKey).includes(
            columns[index].name,
          ))
      ) {
        const patterns = this.createTriplePatterns(
          table,
          columns,
          index,
          queryVars,
        );
        // Required columns are prepended, because OPTIONAL pattern should not be at the beginning.
        // For more information, see createSelectOfOptionalSubjects function bellow.
        if (column.required) {
          allOptional = false;
          lines.unshift(...patterns.split('\n'));
        } else {
          lines.push(...patterns.split('\n'));
        }
        topLevel.push(index);
      }
    }

    if (allOptional) {
      lines.unshift(
        this.createSelectOfOptionalSubjects(
          table,
          columns,
          topLevel,
          queryVars,
        ),
      );
    }

    return [
      columns,
      `SELECT ${columns
        .filter((col, i) => !table.tableSchema.columns[i].virtual)
        .map((column) => `?${column.queryVariable}`)
        .join(' ')}
WHERE {
${
  !useNamedGraphs
    ? lines.join('\n')
    : `  {
${lines.map((line) => `  ${line}`).join('\n')}
  }
  UNION
  {
    GRAPH ?_graph {
${lines.map((line) => `    ${line}`).join('\n')}
    }
  }`
}
}`,
    ];
  }

  /**
   * Creates SPARQL nested SELECT query that is used to prevent matching of OPTIONAL against empty mapping
   * if all patterns are optional by adding all top-level subjects to the result mapping first.
   * {@link https://stackoverflow.com/questions/25131365/sparql-optional-query/61395608#61395608}
   * {@link https://github.com/blazegraph/database/wiki/SPARQL_Order_Matters}
   * @param table CSV Table
   * @param columns Columns including virtual ones
   * @param topLevel Indices of top level columns (i.e. those that does are not referenced by other columns)
   * @returns SPARQL query for selecting subjects with some from the optional tripple
   */
  private createSelectOfOptionalSubjects(
    table: CsvwTableDescriptionWithRequiredColumns,
    columns: CsvwColumn[],
    topLevel: number[],
    queryVars: Record<string, string>,
  ): string {
    const subjects = new Set<string>();
    const alternatives: string[] = [];

    for (const index of topLevel) {
      const column = table.tableSchema.columns[index];

      const aboutUrl = column.aboutUrl;
      const propertyUrl = column.propertyUrl;
      const valueUrl = column.valueUrl;

      const subject = `?${queryVars[aboutUrl ?? '']}`;

      const predicate = propertyUrl
        ? `<${this.expandIri(
            parseTemplate(propertyUrl).expand({
              _column: index + 1,
              _sourceColumn: index + 1,
              _name: columns[index].name,
            }),
          )}>`
        : `<${table.url}#${columns[index].name}>`;

      let object = `?_object`;
      if (
        valueUrl &&
        valueUrl.search(/\{(?!_column|_sourceColumn|_name)[^{}]*\}/) === -1
      ) {
        object = parseTemplate(valueUrl).expand({
          _column: index + 1,
          _sourceColumn: index + 1,
          _name: columns[index].name,
        });
        if (
          column.datatype === 'anyURI' ||
          predicate === '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
        )
          object = `<${this.expandIri(object)}>`;
        else object = `"${object}"`;
      }

      const lines = [`        ${subject} ${predicate} ${object} .`];

      const lang = column.lang;
      if (lang && object.startsWith('?')) {
        // TODO: Should we lower our expectations if the matching language is not found?
        lines.push(`        FILTER LANGMATCHES(LANG(${object}), "${lang}")`);
      }

      if (aboutUrl && subject.startsWith('?')) {
        const templateUrl = this.expandIri(
          parseTemplate(
            aboutUrl.replaceAll(
              /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
              '.*',
            ),
          ).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          }),
        );
        if (templateUrl !== '.*')
          lines.push(
            `        FILTER REGEX(STR(${subject}), "${templateUrl}$")`,
          );
      }

      if (valueUrl && object.startsWith('?')) {
        const templateUrl = this.expandIri(
          parseTemplate(
            valueUrl.replaceAll(
              /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
              '.*',
            ),
          ).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          }),
        );
        if (templateUrl !== '.*')
          lines.push(
            `        FILTER REGEX(STR(${object}), "${templateUrl}$")`,
          );
      }

      subjects.add(subject);
      alternatives.push(`{
${lines.join('\n')}
      }`);
    }

    return `  {
    SELECT DISTINCT ${[...subjects].join(' ')}
    WHERE {
      ${alternatives.join(' UNION ')}
    }
  }`;
  }

  /**
   * Creates SPARQL triple patterns for use in SELECT WHERE query.
   * Triples are created recursively if there are references between the columns.
   * @param table CSV Table
   * @param columns Columns including virtual ones
   * @param index Index of the column for which triples are created
   * @param subject Subject of the triple, it must match the other end of the reference between columns
   * @returns Triple patterns for given column as a string
   */
  private createTriplePatterns(
    table: CsvwTableDescriptionWithRequiredColumns,
    columns: CsvwColumn[],
    index: number,
    queryVars: Record<string, string>,
  ): string {
    const column = table.tableSchema.columns[index];

    const aboutUrl = column.aboutUrl;
    const propertyUrl = column.propertyUrl;
    const valueUrl = column.valueUrl;

    const subject = `?${queryVars[aboutUrl ?? '']}`;

    const predicate = propertyUrl
      ? `<${this.expandIri(
          parseTemplate(propertyUrl).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          }),
        )}>`
      : `<${table.url}#${columns[index].name}>`;

    let object = `?${columns[index].queryVariable}`;
    if (
      valueUrl &&
      valueUrl.search(/\{(?!_column|_sourceColumn|_name)[^{}]*\}/) === -1
    ) {
      object = parseTemplate(valueUrl).expand({
        _column: index + 1,
        _sourceColumn: index + 1,
        _name: columns[index].name,
      });
      if (
        column.datatype === 'anyURI' ||
        predicate === '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
      )
        object = `<${this.expandIri(object)}>`;
      else object = `"${object}"`;
    }

    const lines = [`  ${subject} ${predicate} ${object} .`];

    const lang = column.lang;
    if (lang && object.startsWith('?')) {
      // TODO: Should we lower our expectations if the matching language is not found?
      lines.push(`  FILTER LANGMATCHES(LANG(${object}), "${lang}")`);
    }

    if (aboutUrl && subject.startsWith('?')) {
      const templateUrl = this.expandIri(
        parseTemplate(
          aboutUrl.replaceAll(
            /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
            '.*',
          ),
        ).expand({
          _column: index + 1,
          _sourceColumn: index + 1,
          _name: columns[index].name,
        }),
      );
      if (templateUrl !== '.*')
        lines.push(`  FILTER REGEX(STR(${subject}), "${templateUrl}$")`);
    }

    if (valueUrl && object.startsWith('?')) {
      const templateUrl = this.expandIri(
        parseTemplate(
          valueUrl.replaceAll(
            /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
            '.*',
          ),
        ).expand({
          _column: index + 1,
          _sourceColumn: index + 1,
          _name: columns[index].name,
        }),
      );
      if (templateUrl !== '.*')
        lines.push(`  FILTER REGEX(STR(${object}), "${templateUrl}$")`);
    }

    if (predicate === '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>') {
      if (aboutUrl) {
        table.tableSchema.columns.forEach((col, i) => {
          if (col !== column && col.aboutUrl === aboutUrl) {
            const patterns = this.createTriplePatterns(
              table,
              columns,
              i,
              queryVars,
            );
            lines.push(...patterns.split('\n'));
          }
        });
      }
    } else {
      if (valueUrl) {
        const typeColumn = table.tableSchema.columns.find(
          (col) =>
            col.propertyUrl &&
            this.expandIri(col.propertyUrl) ===
              'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
            col.aboutUrl === valueUrl,
        );
        table.tableSchema.columns.forEach((col, i) => {
          if (col !== column && col.aboutUrl === valueUrl) {
            // filter out columns that are referenced by typeColumn
            // so their triples are not generated twice
            if (
              typeColumn === undefined ||
              (col.propertyUrl &&
                this.expandIri(col.propertyUrl) ===
                  'http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
            ) {
              const patterns = this.createTriplePatterns(
                table,
                columns,
                i,
                queryVars,
              );
              lines.push(...patterns.split('\n'));
            }
          }
        });
      }
    }

    if (!column.required) {
      return `  OPTIONAL {
${lines.map((line) => `  ${line}`).join('\n')}
  }`;
    } else {
      return lines.map((line) => `${line}`).join('\n');
    }
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
   * Creates a new descriptor from the rdf data, used only if no descriptor is provided.
   * @param parser
   * @returns
   */
  private async createDescriptor(
    parser: JsonLdParser | RdfXmlParser | StreamParser<Quad>,
  ): Promise<DescriptorWrapper> {
    const tableGroup = new TableGroupSchema();

    let quad: Quad;
    for await (quad of parser) {
      this.store.put(quad);

      const subject = quad.subject;
      const predicate = quad.predicate;
      const object = quad.object;

      // TODO: should we use information from csvw predicates and types to improve quality?
      if (
        predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        !object.value.startsWith('http://www.w3.org/ns/csvw#')
      ) {
        // TODO: make sure that tableUrls for different types are different
        const tableUrl = object.value.split(/\/|#/).pop() + '.csv';
        let table = tableGroup.getTable(tableUrl);

        if (!table) {
          table = tableGroup.addTable(tableUrl);
          // TODO: names beginning with '_' are reserved by specification and MUST NOT appear in metadata,
          // so I should not use it to ensure unique name of this column
          const column = table.addColumn('_id');
          // TODO: should the column be required?
          column.required = true;
          column.aboutUrl =
            subject.termType !== 'BlankNode' ? subject.value : undefined;
          column.propertyUrl = predicate.value;
          column.valueUrl =
            object.termType !== 'BlankNode' ? object.value : undefined;
        } else {
          const column = table.getColumn('_id') as ColumnSchema;
          column.aboutUrl =
            subject.termType !== 'BlankNode'
              ? this.getCommonUrlTemplate(column.aboutUrl, subject.value)
              : undefined;
        }
      } else if (!predicate.value.startsWith('http://www.w3.org/ns/csvw#')) {
        let hasType = false;
        const stream = await this.engine.queryBindings(
          `SELECT ?_type WHERE { <${subject.value}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?_type }`,
          { baseIRI: '.' },
        );

        for await (const bindings of stream as any) {
          hasType = true;
          const type = bindings.get('_type').value;

          if (!type.startsWith('http://www.w3.org/ns/csvw#')) {
            const tableUrl = type.split(/\/|#/).pop() + '.csv';
            let table = tableGroup.getTable(tableUrl);
            if (!table) table = tableGroup.addTable(tableUrl);

            // TODO: make sure that columnNames for different predicates are different
            const columnName = predicate.value.split(/\/|#/).pop() as string;
            let column = table.getColumn(columnName);
            if (!column) {
              column = table.addColumn(columnName);
              column.aboutUrl =
                subject.termType !== 'BlankNode'
                  ? this.getCommonUrlTemplate(
                      (table.getColumn('_id') as ColumnSchema).aboutUrl,
                      subject.value,
                    )
                  : undefined;
              column.propertyUrl = predicate.value;
              column.valueUrl =
                object.termType !== 'BlankNode' ? object.value : undefined;
            } else {
              column.aboutUrl =
                subject.termType !== 'BlankNode'
                  ? this.getCommonUrlTemplate(column.aboutUrl, subject.value)
                  : undefined;
              column.valueUrl =
                object.termType !== 'BlankNode'
                  ? this.getCommonUrlTemplate(column.valueUrl, object.value)
                  : undefined;
            }
          }
        }

        // TODO: What if some other tripple is reached before type?
        // It should be enough to use a few moving buffers:
        // 1) reading, parsing and putting rdf into quadstore
        // 2) processing tripples to create metadatada descriptor
        // 3) convert to csvw using SPARQL
        if (!hasType) {
          // TODO: make sure that this tableUrl is unique
          const tableUrl = 'default.csv';
          let table = tableGroup.getTable(tableUrl);
          if (!table) table = tableGroup.addTable(tableUrl);

          const columnName = predicate.value.split(/#|\//).pop() as string;
          let column = table.getColumn(columnName);
          if (!column) {
            column = table.addColumn(columnName);
            column.aboutUrl =
              subject.termType !== 'BlankNode' ? subject.value : undefined;
            column.propertyUrl = predicate.value;
            column.valueUrl =
              object.termType !== 'BlankNode' ? object.value : undefined;
          } else {
            column.aboutUrl =
              subject.termType !== 'BlankNode'
                ? this.getCommonUrlTemplate(column.aboutUrl, subject.value)
                : undefined;
            column.valueUrl =
              object.termType !== 'BlankNode'
                ? this.getCommonUrlTemplate(column.valueUrl, object.value)
                : undefined;
          }
        }
      }
    }

    // TODO: schema normalization

    if (this.options.logLevel >= LogLevel.Debug) {
      for (const table of tableGroup.tables)
        console.debug(JSON.stringify(table));
    }

    return new DescriptorWrapper(tableGroup, new Map());
  }

  private getCommonUrlTemplate(
    first: string | undefined,
    second: string | undefined,
  ): string | undefined {
    // _row, _sourceRow and columns references are the only URI template properties that does not depend on the column
    // TODO: is this implementation sufficient, or should I add common column references to url template (_sourceRow is not needed here)?

    if (!first || !second) return undefined;

    const a = [...first.matchAll(/\d+/g)];
    if (a.length === 0 || a.some((val) => val !== a[0])) return undefined;
    const template = first.replaceAll(/\d+/g, '{_row}');

    const b = [...second.matchAll(/\d+/g)];
    if (b.length === 0 || b.some((val) => val !== b[0])) return undefined;
    if (second.replaceAll(/\d+/g, '{_row}') !== template) return undefined;

    return template;
  }

  /**
   * Sets the default options for the options not provided.
   * @param options
   */
  private setDefaults(options?: Rdf2CsvOptions): OptionsWithDefaults {
    options ??= {};
    return {
      pathOverrides: options.pathOverrides ?? [],
      baseIri: options.baseIri ?? '',
      logLevel: options.logLevel ?? LogLevel.Warn,
      resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveJsonldFn,
      resolveRdfStreamFn: options.resolveRdfStreamFn ?? defaultResolveStreamFn,
    };
  }

  private async openStore() {
    const backend = new MemoryLevel() as any;
    // different versions of RDF.js types in quadstore and n3
    this.store = new Quadstore({
      backend,
      dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
    });
    this.engine = new Engine(this.store);
    await this.store.open();
  }
}
