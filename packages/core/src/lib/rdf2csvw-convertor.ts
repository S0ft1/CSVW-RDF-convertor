import { LogLevel, Rdf2CsvOptions } from './conversion-options.js';
import { DescriptorWrapper, normalizeDescriptor } from './descriptor.js';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
} from './req-resolve.js';
import { transformStream } from './transformation-stream.js';

import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
import { CsvwTableDescriptionWithRequiredColumns } from './types/descriptor/table.js';
import { CsvwTableDescription } from './types/descriptor/table.js';

import { CsvLocationTracker } from './utils/code-location.js';
import { coerceArray } from './utils/coerce.js';
import { commonPrefixes } from './utils/prefix.js';
import { IssueTracker } from './utils/issue-tracker.js';

import { MemoryLevel } from 'memory-level';
import { DataFactory, StreamParser } from 'n3';
import { Quadstore, StoreOpts } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { JsonLdParser } from 'jsonld-streaming-parser';
import { Bindings, ResultStream } from '@rdfjs/types';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { parseTemplate } from 'url-template';

// TODO: Can these types be improved for better readability and ease of use?
export type CsvwColumn = { name: string; title: string; queryVariable: string };
export type CsvwTablesStream = {
  [tableName: string]: [
    columns: CsvwColumn[],
    rowsStream: ResultStream<Bindings>
  ];
};

export class Rdf2CsvwConvertor {
  private options: Required<Rdf2CsvOptions>;
  private location = new CsvLocationTracker();
  public issueTracker = new IssueTracker(this.location, {
    collectIssues: false,
  });
  private store: Quadstore;
  private engine: Engine;

  public constructor(options?: Rdf2CsvOptions) {
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
    descriptor?: string | AnyCsvwDescriptor
  ): Promise<CsvwTablesStream> {
    // XXX: ResultStream will be merged with Stream upon the next major change of rdf.js library
    let wrapper: DescriptorWrapper;
    if (descriptor === undefined) {
      wrapper = this.createDescriptor(url);
    } else {
      wrapper = await normalizeDescriptor(
        descriptor,
        this.options,
        this.issueTracker
      );
    }
    await this.openStore();

    // Now we have a descriptor either from user or from rdf data.
    // TODO: What if we do not have enough memory to hold all the quads in the store?
    const readableStream = await this.options.resolveRdfStreamFn(url, '');
    let parser;
    if (url.match(/\.(rdf|xml)([?#].*)?$/)) {
      parser = new RdfXmlParser();
    } else if (url.match(/\.jsonld([?#].*)?$/)) {
      parser = new JsonLdParser();
    } else {
      // TODO: By default, N3.Parser parses a permissive superset of Turtle, TriG, N-Triples, and N-Quads. For strict compatibility with any of those languages, pass a format argument upon creation.
      parser = new StreamParser();
    }
    const useNamedGraphs = url.match(/\.(nq|trig)([?#].*)?$/) !== null;

    for await (const chunk of readableStream) {
      parser.write(chunk);
    }
    parser.end();

    await this.store.putStream(parser);

    const tables = wrapper.isTableGroup
      ? wrapper.getTables()
      : ([wrapper.descriptor] as CsvwTableDescription[]);
    const streams = {} as CsvwTablesStream;
    let openedStreamsCount = 0;

    for (const table of tables) {
      // TODO: use IssueTracker
      if (!table.tableSchema?.columns) {
        if (this.options.logLevel >= LogLevel.Warn)
          console.warn(`Skipping table ${table.url}: no columns found`);
        continue;
      }
      if (table.suppressOutput === true) {
        if (this.options.logLevel >= LogLevel.Warn)
          console.warn(
            `Skipping table ${table.url}: suppressOutput set to true`
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

      const columns: CsvwColumn[] =
        tableWithRequiredColumns.tableSchema.columns.map((col, i) => {
          const defaultLang =
            (wrapper.descriptor['@context']?.[1] as any)?.['@language'] ??
            '@none';

          let name = `_col.${i + 1}`;
          if (col.name !== undefined) {
            name = encodeURIComponent(col.name);
          } else if (col.titles !== undefined) {
            if (typeof col.titles === 'string' || Array.isArray(col.titles)) {
              name = encodeURIComponent(coerceArray(col.titles)[0]);
            } else {
              // TODO: use else (startsWith(defaultLang)) as in core/src/lib/csvw2rdf/convertor.ts, or set inherited properties just away in normalizeDescriptor().
              if (defaultLang in col.titles) {
                name = encodeURIComponent(
                  coerceArray(col.titles[defaultLang])[0]
                );
              }
            }
          }

          let title = `_col.${i + 1}`;
          if (col.titles !== undefined) {
            if (typeof col.titles === 'string' || Array.isArray(col.titles)) {
              title = coerceArray(col.titles)[0];
            } else {
              // TODO: use else (startsWith(defaultLang)) as in core/src/lib/csvw2rdf/convertor.ts, or set inherited properties just away in normalizeDescriptor().
              if (defaultLang in col.titles) {
                title = coerceArray(col.titles[defaultLang])[0];
              }
            }
          } else if (col.name !== undefined) {
            title = col.name;
          }

          // note that queryVariable does not contain dot that is special char in SPARQL.
          return { name: name, title: title, queryVariable: `_col${i + 1}` };
        });
      const query = this.createQuery(
        tableWithRequiredColumns,
        columns,
        useNamedGraphs
      );
      if (this.options.logLevel >= LogLevel.Debug) console.debug(query);

      const stream = transformStream(
        // XXX: quadstore-comunica does not support unionDefaultGraph option of comunica, so UNION must be used manually in the query.
        await this.engine.queryBindings(query, { baseIRI: '.' }),
        tableWithRequiredColumns,
        columns,
        this.issueTracker
      );
      openedStreamsCount++;
      streams[tableWithRequiredColumns.url] = [
        columns.filter(
          (col, i) => !tableWithRequiredColumns.tableSchema.columns[i].virtual
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
    columns: CsvwColumn[],
    useNamedGraphs: boolean
  ) {
    const lines: string[] = [];
    let allOptional = true;
    const topLevel: number[] = [];
    for (let index = 0; index < table.tableSchema.columns.length; index++) {
      const column = table.tableSchema.columns[index];
      const referencedBy = table.tableSchema.columns.find(
        (col) =>
          col !== column && col.valueUrl && col.valueUrl === column.aboutUrl
      );

      if (
        !referencedBy ||
        (table.tableSchema.primaryKey &&
          table.tableSchema.primaryKey === column.name)
      ) {
        const patterns = this.createTriplePatterns(
          table,
          columns,
          index,
          '?_blank'
        );
        // Required columns are prepended, because OPTIONAL pattern should not be at the beginning.
        // For more information, see comment bellow.
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
      // We need to prevent matching of OPTIONAL against empty mapping, if all patterns are optional.
      // So all top-level subjects are added to the result mapping first.
      // https://stackoverflow.com/questions/25131365/sparql-optional-query/61395608#61395608
      // https://github.com/blazegraph/database/wiki/SPARQL_Order_Matters
      lines.unshift(
        `  {
    SELECT DISTINCT ?_blank WHERE {
      ?_blank ${topLevel
        .map((index) => {
          const column = table.tableSchema.columns[index];
          return column.propertyUrl
            ? `<${this.expandIri(
                parseTemplate(column.propertyUrl).expand({
                  _column: index + 1,
                  _sourceColumn: index + 1,
                  _name: columns[index].name,
                })
              )}>`
            : `<${table.url}#${columns[index].name}>`;
        })
        .join('|')} ?_object
    }
  }`
      );
    }

    return `SELECT ${columns
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
    subject: string
  ): string {
    const column = table.tableSchema.columns[index];

    const predicate = column.propertyUrl
      ? `<${this.expandIri(
          parseTemplate(column.propertyUrl).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          })
        )}>`
      : `<${table.url}#${columns[index].name}>`;

    let object: string;
    if (
      column.valueUrl &&
      parseTemplate(column.valueUrl).expand({
        _column: index + 1,
        _sourceColumn: index + 1,
        _name: columns[index].name,
      }) === column.valueUrl
    ) {
      if (
        column.datatype === 'anyURI' ||
        predicate === '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
      )
        object = `<${this.expandIri(column.valueUrl)}>`;
      else object = `"${column.valueUrl}"`;
    } else {
      object = `?${columns[index].queryVariable}`;
    }

    const lines = [`  ${subject} ${predicate} ${object} .`];
    if (column.lang) {
      // TODO: Should we be more benevolent and use LANGMATCHES instead of string equality?
      // TODO: Should we lower our expectations if the matching language is not found?
      lines.push(`  FILTER (LANG(${object}) = '${column.lang}')`);
    }

    if (column.valueUrl) {
      table.tableSchema.columns.forEach((col, i) => {
        if (col !== column && col.aboutUrl === column.valueUrl) {
          const patterns = this.createTriplePatterns(table, columns, i, object);
          lines.push(...patterns.split('\n'));
        }
      });
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
   * @param rdfData The rdf data to create the descriptor from
   */
  private createDescriptor(rdfData: string): DescriptorWrapper {
    return {} as DescriptorWrapper;
  }

  /**
   * Sets the default options for the options not provided.
   * @param options
   */
  private setDefaults(options?: Rdf2CsvOptions): Required<Rdf2CsvOptions> {
    options ??= {};
    return {
      pathOverrides: options.pathOverrides ?? [],
      baseIri: options.baseIri ?? '',
      logLevel: options.logLevel ?? LogLevel.Warn,
      resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveJsonldFn,
      resolveRdfStreamFn: options.resolveRdfStreamFn ?? defaultResolveStreamFn,
      descriptorNotProvided: options.descriptorNotProvided ?? false,
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
