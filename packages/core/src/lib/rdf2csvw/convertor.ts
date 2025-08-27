import { LogLevel, Rdf2CsvOptions } from '../conversion-options.js';
import { DescriptorWrapper, normalizeDescriptor } from '../descriptor.js';
import { DefaultFetchCache } from '../fetch-cache.js';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
} from '../req-resolve.js';
import { SchemaInferrer } from './schema-inferrer.js';
import { transformStream } from './transformation-stream.js';
import { WindowStore } from './window-store.js';

import { TableGroupSchema } from './schema/table-group-schema.js';

import {
  CsvwTableDescription,
  CsvwTableDescriptionWithRequiredColumns,
} from '../types/descriptor/table.js';

import { CsvLocationTracker } from '../utils/code-location.js';
import { coerceArray } from '../utils/coerce.js';
import { commonPrefixes } from '../utils/prefix.js';
import { expandIri } from '../utils/expand-iri.js';
import { IssueTracker } from '../utils/issue-tracker.js';

import { MemoryLevel } from 'memory-level';
import { Queue } from 'mnemonist';
import { DataFactory } from 'n3';
import { Quadstore, StoreOpts } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { Readable } from 'readable-stream';
import { Stream, Quad } from '@rdfjs/types';
import { parseTemplate } from 'url-template';

// TODO: Can these types be improved for better readability and ease of use?
export type CsvwColumn = { name: string; title: string };
export type CsvwColumnWithQueryVar = CsvwColumn & { queryVariable: string };
export type CsvwRow = { [column: string]: string };
export type CsvwTable = {
  name: string;
  columns: CsvwColumn[];
};

type NullableOptions = 'descriptor' | 'windowSize';
export type OptionsWithDefaults = Required<
  Omit<Rdf2CsvOptions, NullableOptions>
> &
  Pick<Rdf2CsvOptions, NullableOptions>;

const { rdf } = commonPrefixes;

export class Rdf2CsvwConvertor {
  private options: OptionsWithDefaults;
  private location = new CsvLocationTracker();
  public issueTracker = new IssueTracker(this.location, {
    collectIssues: false,
  });
  private store: WindowStore;
  private engine: Engine;

  private wrapper: DescriptorWrapper;
  private schemaInferrer: SchemaInferrer;

  constructor(options?: Rdf2CsvOptions) {
    this.options = this.setDefaults(options);
  }

  /**
   * Main conversion function. Converts the rdf data to csvw format.
   * @param url Url of rdf data to convert
   * @param descriptor CSVW descriptor to use for the conversion. If not provided, a new descriptor will be created from the rdf data.
   * @returns A stream of csvw data.
   */
  public async convert(stream: Stream<Quad>): Promise<Readable> {
    const queue: Queue<[DescriptorWrapper, CsvwTable, CsvwRow]> = new Queue<
      [DescriptorWrapper, CsvwTable, CsvwRow]
    >();

    const outputStream = new Readable({
      objectMode: true,
      read: async () => {
        if (queue.size != 0) {
          outputStream.push(queue.dequeue());
          return;
        }

        let dequeued;
        do {
          let added: Quad[];

          if (this.store === undefined) {
            await this.openStore(stream);
            added = await Array.fromAsync(
              (this.store as WindowStore).store.match(),
            );

            if (this.options.descriptor) {
              if (this.options.descriptor instanceof TableGroupSchema) {
                // TODO: Change normalizeDescriptor API instead of this
                this.wrapper = new DescriptorWrapper(
                  this.options.descriptor,
                  new Map(),
                );
              } else {
                this.wrapper = await normalizeDescriptor(
                  this.options.descriptor,
                  this.options,
                  this.issueTracker,
                );
              }
            } else {
              this.schemaInferrer = new SchemaInferrer(
                this.store,
                this.options,
              );
            }
          } else {
            if (this.store.done) {
              outputStream.push(null);
              return;
            }
            [added] = await this.store.moveWindow();
          }

          if (this.schemaInferrer) {
            for (const quad of added) {
              this.schemaInferrer.addQuadToSchema(quad);
            }

            this.schemaInferrer.lockCurrentSchema();

            this.wrapper = new DescriptorWrapper(
              this.schemaInferrer.schema,
              new Map(),
            );
          }

          const tables = this.wrapper.isTableGroup
            ? this.wrapper.getTables()
            : ([this.wrapper.descriptor] as CsvwTableDescription[]);

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
              this.wrapper,
            );
            if (this.options.logLevel >= LogLevel.Debug) console.debug(query);

            const rowStream = transformStream(
              // XXX: quadstore-comunica does not support unionDefaultGraph option of comunica, so UNION must be used manually in the query.
              await this.engine.queryBindings(query, { baseIRI: '.' }),
              tableWithRequiredColumns,
              columns,
              this.issueTracker,
            );

            const csvwTable: CsvwTable = {
              name: tableWithRequiredColumns.url.replace(/[?#].*$/, ''),
              columns: columns.filter(
                (col, i) =>
                  !tableWithRequiredColumns.tableSchema.columns[i].virtual,
              ),
            };
            for await (const row of rowStream) {
              queue.enqueue([this.wrapper, csvwTable, row]);
            }
          }
          dequeued = queue.dequeue();
        } while (dequeued === undefined);
        outputStream.push(dequeued);
      },
    });

    outputStream.once('end', () => this.store.store.close());

    return outputStream;
  }

  public async inferSchema(rdf: Stream<Quad>) {
    await this.openStore(rdf);
    this.schemaInferrer = new SchemaInferrer(this.store, this.options);
    await this.schemaInferrer.inferSchema();
    await this.store.store.close();
    return this.schemaInferrer.schema;
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
    wrapper: DescriptorWrapper,
  ): [CsvwColumnWithQueryVar[], string] {
    let queryVarCounter = 0;
    const queryVars: Record<string, string> = {};

    const columns: CsvwColumnWithQueryVar[] = table.tableSchema.columns.map(
      (column, i) => {
        const defaultLang =
          (wrapper.descriptor['@context']?.[1] as any)?.['@language'] ??
          '@none';

        let name = `_col.${i + 1}`;
        if (column.name !== undefined) {
          name = encodeURIComponent(column.name);
        } else if (column.titles !== undefined) {
          if (
            typeof column.titles === 'string' ||
            Array.isArray(column.titles)
          ) {
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
          if (
            typeof column.titles === 'string' ||
            Array.isArray(column.titles)
          ) {
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
        if (propertyUrl && expandIri(propertyUrl) === rdf + 'type') {
          queryVar = queryVars[aboutUrl ?? ''];
        } else {
          queryVar = valueUrl ? queryVars[valueUrl] : `_${queryVarCounter++}`;
        }

        return { name: name, title: title, queryVariable: queryVar };
      },
    );

    const lines: string[] = [];
    let allOptional = true;
    const topLevel: number[] = [];
    for (let index = 0; index < table.tableSchema.columns.length; index++) {
      const column = table.tableSchema.columns[index];

      const aboutUrl = column.aboutUrl;
      const referencedBy = table.tableSchema.columns.find((col) => {
        if (col.propertyUrl && expandIri(col.propertyUrl) === rdf + 'type')
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
  {
${lines.map((line) => `  ${line}`).join('\n')}
  }
  UNION
  {
    GRAPH ?_graph {
${lines.map((line) => `    ${line}`).join('\n')}
    }
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
        ? `<${expandIri(
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
        if (column.datatype === 'anyURI' || predicate === `<${rdf}type>`)
          object = `<${expandIri(object)}>`;
        else object = `"${object}"`;
      }

      const lines = [`        ${subject} ${predicate} ${object} .`];

      const lang = column.lang;
      if (lang && object.startsWith('?')) {
        // TODO: Should we lower our expectations if the matching language is not found?
        lines.push(`        FILTER LANGMATCHES(LANG(${object}), "${lang}")`);
      }

      if (aboutUrl && subject.startsWith('?')) {
        const templateUrl = expandIri(
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
        const templateUrl = expandIri(
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
          lines.push(`        FILTER REGEX(STR(${object}), "${templateUrl}$")`);
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
    columns: CsvwColumnWithQueryVar[],
    index: number,
    queryVars: Record<string, string>,
  ): string {
    const column = table.tableSchema.columns[index];

    const aboutUrl = column.aboutUrl;
    const propertyUrl = column.propertyUrl;
    const valueUrl = column.valueUrl;

    const subject = `?${queryVars[aboutUrl ?? '']}`;

    const predicate = propertyUrl
      ? `<${expandIri(
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
      if (column.datatype === 'anyURI' || predicate === `<${rdf}type>`)
        object = `<${expandIri(object)}>`;
      else object = `"${object}"`;
    }

    const lines = [`  ${subject} ${predicate} ${object} .`];

    const lang = column.lang;
    if (lang && object.startsWith('?')) {
      // TODO: Should we lower our expectations if the matching language is not found?
      lines.push(`  FILTER LANGMATCHES(LANG(${object}), "${lang}")`);
    }

    if (aboutUrl && subject.startsWith('?')) {
      const templateUrl = expandIri(
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
      const templateUrl = expandIri(
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

    if (predicate === `<${rdf}type>`) {
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
            expandIri(col.propertyUrl) === rdf + 'type' &&
            col.aboutUrl === valueUrl,
        );
        table.tableSchema.columns.forEach((col, i) => {
          if (col !== column && col.aboutUrl === valueUrl) {
            // filter out columns that are referenced by typeColumn
            // so their triples are not generated twice
            if (
              typeColumn === undefined ||
              (col.propertyUrl && expandIri(col.propertyUrl) === rdf + 'type')
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
      useVocabMetadata: true,
      resolveRdfFn: options.resolveRdfFn ?? defaultResolveStreamFn,
      descriptor: options.descriptor,
      windowSize: options.windowSize,
      cache: options.cache ?? new DefaultFetchCache(),
    };
  }

  private async openStore(stream: Stream<Quad>) {
    const backend = new MemoryLevel() as any;
    // different versions of RDF.js types in quadstore and n3
    const qstore = new Quadstore({
      backend,
      dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
    });
    await qstore.open();
    this.engine = new Engine(qstore);
    this.store = new WindowStore(qstore, stream, this.options?.windowSize);
    await this.store.initStream();
  }
}
