import { transform } from './bindings-to-row-transformation.js';
import { LogLevel, Rdf2CsvOptions } from '../conversion-options.js';
import { createQuery } from './create-query.js';
import { DescriptorWrapper, normalizeDescriptor } from '../descriptor.js';
import { DefaultFetchCache } from '../fetch-cache.js';
import {
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
} from '../req-resolve.js';
import { SchemaInferrer } from './schema-inferrer.js';
import { WindowStore } from './window-store.js';

import { TableGroupSchema } from './schema/table-group-schema.js';

import {
  CsvwTableDescription,
  CsvwTableDescriptionWithRequiredColumns,
} from '../types/descriptor/table.js';

import { CsvLocationTracker } from '../utils/code-location.js';
import { IssueTracker } from '../utils/issue-tracker.js';

import { MemoryLevel } from 'memory-level';
import { Queue } from 'mnemonist';
import { DataFactory } from 'n3';
import { Quadstore, StoreOpts } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { Readable } from 'readable-stream';
import { Stream, Quad, ResultStream, Bindings } from '@rdfjs/types';
import { commonPrefixes } from '../utils/prefix.js';
import { expandIri } from '../utils/expand-iri.js';

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

type QueryRecords = {
  result: ResultStream<Bindings>;
  table: CsvwTableDescriptionWithRequiredColumns;
  columns: CsvwColumnWithQueryVar[];
};

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
   * @param stream A stream of input rdf quads.
   * @returns A stream of csvw data.
   */
  public async convert(stream: Stream<Quad>): Promise<Readable> {
    await this.openStore(stream);

    let previouslyAdded: Quad[] = [];
    let added: Quad[] = await Array.fromAsync(this.store.store.match());
    let removed: Quad[] = [];

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
      this.schemaInferrer = new SchemaInferrer(this.store, this.options);
      await this.updateDescriptor(added);
    }

    const outputQueue: Queue<null | [DescriptorWrapper, CsvwTable, CsvwRow]> =
      new Queue<null | [DescriptorWrapper, CsvwTable, CsvwRow]>();

    const outputStream = new Readable({
      objectMode: true,
      read: async () => {
        while (outputQueue.size == 0) {
          // create SPARQL query and add new bindings to the queue
          const tables = this.wrapper.isTableGroup
            ? this.wrapper.getTables()
            : ([this.wrapper.descriptor] as CsvwTableDescription[]);

          const queryRecords: QueryRecords[] = [];

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

            const [columns, query] = createQuery(
              tableWithRequiredColumns,
              this.wrapper,
            );
            if (this.options.logLevel >= LogLevel.Debug) console.debug(query);

            const resultStream = await this.engine.queryBindings(query, {
              baseIRI: '.',
            });

            queryRecords.push({
              result: resultStream,
              table: tableWithRequiredColumns,
              columns: columns,
            });
          }

          const previouslyDone = this.store.done;
          previouslyAdded = added;
          [added, removed] = await this.store.moveWindow();

          for (const record of queryRecords) {
            for await (const bindings of record.result as any) {
              if (
                this.anyBindingInPreviousAndNotInAdded(
                  bindings,
                  record.table,
                  record.columns,
                  previouslyAdded,
                  added,
                  removed,
                )
              )
                outputQueue.enqueue([
                  this.wrapper,
                  {
                    name: record.table.url.replace(/[?#].*$/, ''),
                    columns: record.columns
                      .filter(
                        (col, i) =>
                          !record.table.tableSchema.columns[i].virtual,
                      )
                      .map((col) => {
                        return { name: col.name, title: col.title };
                      }),
                  },
                  transform(
                    bindings,
                    record.table,
                    record.columns,
                    this.issueTracker,
                  ),
                ]);
            }
          }

          if (previouslyDone) {
            outputQueue.enqueue(null);
          } else if (this.schemaInferrer) {
            await this.updateDescriptor(added);
          }
        }

        outputStream.push(outputQueue.dequeue());
      },
    });

    outputStream.once('end', () => this.store.store.close());

    return outputStream;
  }

  private anyBindingInPreviousAndNotInAdded(
    bindings: Bindings,
    tableDescription: CsvwTableDescriptionWithRequiredColumns,
    columns: CsvwColumnWithQueryVar[],
    previous: Quad[],
    added: Quad[],
    removed: Quad[],
  ): boolean {
    let inPrevious = false;
    let inAdded = false;
    let inRemoved = false;

    for (let i = 0; i < columns.length; i++) {
      const columnDescription = tableDescription.tableSchema.columns[i];
      const term = bindings.get(columns[i].queryVariable);

      if (
        columnDescription.propertyUrl &&
        expandIri(columnDescription.propertyUrl) === rdf + 'type'
      ) {
        inPrevious ||= previous.some((quad) => quad.subject.equals(term));
        inAdded ||= added.some((quad) => quad.subject.equals(term));
        inRemoved ||= removed.some((quad) => quad.subject.equals(term));
      } else {
        inPrevious ||= previous.some((quad) => quad.object.equals(term));
        inAdded ||= added.some((quad) => quad.object.equals(term));
        inRemoved ||= removed.some((quad) => quad.object.equals(term));
      }
    }

    return inPrevious && (inRemoved || !inAdded);
  }

  /**
   * Updates descriptor.
   * @param addedQuads new quads added to the store
   */
  private async updateDescriptor(addedQuads: Quad[]) {
    for await (const quad of addedQuads) {
      this.schemaInferrer.addQuadToSchema(quad);
    }

    this.schemaInferrer.lockCurrentSchema();
    // TODO: add conversion function
    this.wrapper = new DescriptorWrapper(this.schemaInferrer.schema, new Map());
  }

  public async inferSchema(rdf: Stream<Quad>) {
    await this.openStore(rdf);
    this.schemaInferrer = new SchemaInferrer(this.store, this.options);
    await this.schemaInferrer.inferSchema();
    await this.store.store.close();
    return this.schemaInferrer.schema;
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
