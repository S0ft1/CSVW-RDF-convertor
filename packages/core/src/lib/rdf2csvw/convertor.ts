import { LogLevel, Rdf2CsvOptions } from '../conversion-options.js';
import { createQuery } from './create-query.js';
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
import { IssueTracker } from '../utils/issue-tracker.js';

import { MemoryLevel } from 'memory-level';
import { Queue } from 'mnemonist';
import { DataFactory } from 'n3';
import { Quadstore, StoreOpts } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { Readable } from 'readable-stream';
import { Stream, Quad } from '@rdfjs/types';

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

            const [columns, query] = createQuery(
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
