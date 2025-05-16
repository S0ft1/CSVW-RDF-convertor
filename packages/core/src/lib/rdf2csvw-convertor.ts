import { Rdf2CsvOptions } from './conversion-options.js';
import { DescriptorWrapper, normalizeDescriptor } from './descriptor.js';
import { defaultResolveJsonldFn } from './req-resolve.js';

import { CsvwColumnDescription } from './types/descriptor/column-description.js';
import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
import { CsvwTableDescription } from './types/descriptor/table.js';

import { commonPrefixes } from './utils/prefix.js';
import { IssueTracker } from './utils/issue-tracker.js';

import { MemoryLevel } from 'memory-level';
import { DataFactory, StreamParser } from 'n3';
import { Quadstore, StoreOpts } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { Bindings, ResultStream } from '@rdfjs/types';
import { Readable } from 'stream';
import { parseTemplate } from 'url-template';

export class Rdf2CsvwConvertor {
  private options: Required<Rdf2CsvOptions>;
  public issueTracker: IssueTracker;
  private store: Quadstore;
  private engine: Engine;

  public constructor(options?: Rdf2CsvOptions) {
    this.options = this.setDefaults(options);
  }

  /**
   * Main conversion function. Converts the rdf data to csvw format.
   * @param data Input rdf data to convert
   * @param descriptor CSVW descriptor to use for the conversion. If not provided, a new descriptor will be created from the rdf data.
   * @returns A stream of csvw data.
   */
  public async convert(
    data: string,
    descriptor?: string | AnyCsvwDescriptor
  ): Promise<{ [key: string]: ResultStream<Bindings> }> {
    // XXX: ResultStream will be merged with Stream upon the next major change of rdf.js library
    let wrapper: DescriptorWrapper;
    if (descriptor === undefined) {
      wrapper = this.createDescriptor(data);
    } else {
      wrapper = await normalizeDescriptor(
        descriptor,
        this.options,
        this.issueTracker
      );
    }
    await this.openStore();

    // Now we have a descriptor either from user or from rdf data.
    const reader = Readable.from(data);
    const parser = new StreamParser({ format: 'text/turtle' });
    await this.store.putStream(reader.pipe(parser), { batchSize: 100 });

    const tables = wrapper.isTableGroup
      ? wrapper.getTables()
      : ([wrapper.descriptor] as CsvwTableDescription[]);
    const streams = {} as { [key: string]: ResultStream<Bindings> };
    let openedStreamsCount = 0;

    for (const table of tables) {
      if (!table.tableSchema?.columns || table.suppressOutput === true)
        continue;

      // See https://w3c.github.io/csvw/metadata/#tables for jsonld descriptor specification
      // and https://www.w3.org/TR/csv2rdf/ for conversion in the other direction

      // TODO: rdf lists
      // TODO: skip columns
      // TODO: use column titles when name is undefined

      const query = `SELECT ${table.tableSchema.columns
        .filter((column) => !column.virtual)
        .map((column, i) => `?${column.name ?? `_col.${i + 1}`}`)
        .join(' ')}
WHERE {
${table.tableSchema.columns
  .map((_, i) =>
    this.createTripplePatterns(table, i)
  )
  .filter((line) => line !== undefined)
  .join('\n')}
}`;

      //console.log(query);

      const stream = await this.engine.queryBindings(query, {
        baseIri:
          (Array.isArray(wrapper.descriptor['@context']) &&
            wrapper.descriptor['@context'][1]?.['@base']) ||
          this.options.baseIri,
      });
      openedStreamsCount++;
      streams[table.url] = stream;
      stream.once('end', () => {
        if (--openedStreamsCount === 0) this.store.close();
      });
    }

    return streams;
  }

  /**
   * Creates SPARQL tripple patterns for the use in SELECT WHERE query.
   * @param table CSV Table
   * @param index Index of the column
   * @param subject Subject of the nested tripples that are referenced using aboutUrl
   * @returns Tripple patterns for given column as string
   */
  private createTripplePatterns(
    table: CsvwTableDescription,
    index: number,
    subject?: string,
  ): string | undefined {
    const column = table.tableSchema!.columns![index] as CsvwColumnDescription;
    const name = column.name ?? `_col.${index + 1}`;

    if (
      column.aboutUrl &&
      table.tableSchema!.columns!.find(
        (col) => col.valueUrl == column.aboutUrl
      ) &&
      !subject &&
      (typeof table.tableSchema?.primaryKey === 'string'
        ? table.tableSchema.primaryKey !== column.name
        : !table.tableSchema?.primaryKey?.includes(column.name!))
    ) {
      return undefined;
    }

    subject ??= '?_blank'
    const predicate = column.propertyUrl
      ? `<${this.expandIri(
          parseTemplate(column.propertyUrl).expand({
            _column: index + 1,
            _source_column: index + 1,
            _name: name,
          })
        )}>`
      : `<${table.url}#${name}>`;
    const object = `?${name}`;

    const lines: string[] = [`  ${subject} ${predicate} ${object} .`];

    if (column.valueUrl) {
      table.tableSchema!.columns!.forEach((col, i) => {
        if (col.aboutUrl === column.valueUrl) {
          const pattern = this.createTripplePatterns(
            table,
            i,
            object,
          );
          if (pattern) lines.push(...pattern.split('\n'));
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
      resolveJsonldFn: options.resolveJsonldFn ?? defaultResolveJsonldFn,
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
