import { LogLevel, Rdf2CsvOptions } from './conversion-options.js';
import { DescriptorWrapper, normalizeDescriptor } from './descriptor.js';
import { defaultResolveJsonldFn } from './req-resolve.js';

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
  ): Promise<{ [key: string]: [string[], ResultStream<Bindings>] }> {
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
    const streams = {} as { [key: string]: [string[], ResultStream<Bindings>] };
    let openedStreamsCount = 0;

    for (const table of tables) {
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

      // See https://w3c.github.io/csvw/metadata/#tables for jsonld descriptor specification
      // and https://www.w3.org/TR/csv2rdf/ for conversion in the other direction

      // TODO: rdf lists
      // TODO: skip columns
      // TODO: row number in url templates

      const columnNames = table.tableSchema.columns.map(
        (col, i) => col.name ?? `_col${i + 1}`
      );
      const query = this.createQuery(table, columnNames);
      if (this.options.logLevel >= LogLevel.Debug) console.debug(query);

      const stream = await this.engine.queryBindings(query, {
        baseIRI: '.',
      });
      openedStreamsCount++;
      streams[table.url] = [
        columnNames.filter((col, i) => !table.tableSchema!.columns![i].virtual),
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

  private createQuery(table: CsvwTableDescription, columnNames: string[]) {
    const lines: string[] = [];
    for (let index = 0; index < table.tableSchema!.columns!.length; index++) {
      const column = table.tableSchema!.columns![index];
      const referencedBy = table.tableSchema!.columns!.find((col) => {
        if (
          col.propertyUrl &&
          this.expandIri(col.propertyUrl) ===
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
        )
          return (
            col !== column && col.aboutUrl && col.aboutUrl === column.aboutUrl
          );
        else
          return (
            col !== column && col.valueUrl && col.valueUrl === column.aboutUrl
          );
      });

      if (
        !referencedBy ||
        (table.tableSchema!.primaryKey &&
          table.tableSchema!.primaryKey === column.name)
      ) {
        const patterns = this.createTriplePatterns(
          table,
          columnNames,
          index,
          column.propertyUrl &&
            this.expandIri(column.propertyUrl) ===
              'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
            ? `?${columnNames[index]}`
            : '?_blank'
        );
        lines.push(...patterns.split('\n'));
      }
    }

    return `SELECT ${columnNames
      .filter((col, i) => !table.tableSchema!.columns![i].virtual)
      .map((name) => `?${name}`)
      .join(' ')}
WHERE {
${lines.join('\n')}
}`;
  }

  /**
   * Creates SPARQL triple patterns for the use in SELECT WHERE query.
   * @param table CSV Table
   * @param index Index of the column
   * @param subject Subject of the nested triples that are referenced using aboutUrl
   * @returns Triple patterns for given column as string
   */
  private createTriplePatterns(
    table: CsvwTableDescription,
    columnNames: string[],
    index: number,
    subject: string
  ): string {
    const column = table.tableSchema!.columns![index];

    const predicate = column.propertyUrl
      ? `<${this.expandIri(
          parseTemplate(column.propertyUrl).expand({
            _column: index + 1,
            _source_column: index + 1,
            _name: columnNames[index],
          })
        )}>`
      : `<${table.url}#${columnNames[index]}>`;

    const referencingIndex = table.tableSchema!.columns!.findIndex(
      (col) =>
        col.propertyUrl &&
        this.expandIri(col.propertyUrl) ===
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        col.aboutUrl == column.valueUrl
    );
    let object: string;
    if (
      column.valueUrl &&
      parseTemplate(column.valueUrl).expand({
        _column: index + 1,
        _source_column: index + 1,
        _name: columnNames[index],
      }) === column.valueUrl
    ) {
      if (
        column.datatype === 'anyURI' ||
        predicate === '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
      )
        object = `<${this.expandIri(column.valueUrl)}>`;
      else object = `"${column.valueUrl}"`;
    } else {
      if (referencingIndex !== -1) object = `?${columnNames[referencingIndex]}`;
      else object = `?${columnNames[index]}`;
    }

    const lines = [`  ${subject} ${predicate} ${object} .`];
    if (column.lang) {
      // TODO: Should we be more benevolent and use LANGMATCHES instead of string equality?
      // TODO: Should we lower our expectations if the matching language is not found?
      lines.push(`  FILTER (LANG(${object}) = '${column.lang}')`);
    }

    if (
      column.propertyUrl &&
      this.expandIri(column.propertyUrl) ===
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    ) {
      if (column.aboutUrl) {
        table.tableSchema!.columns!.forEach((col, i) => {
          if (col !== column && col.aboutUrl === column.aboutUrl) {
            const patterns = this.createTriplePatterns(
              table,
              columnNames,
              i,
              subject
            );
            lines.push(...patterns.split('\n'));
          }
        });
      }
    } else {
      if (column.valueUrl) {
        table.tableSchema!.columns!.forEach((col, i) => {
          if (col !== column && col.aboutUrl === column.valueUrl) {
            const patterns = this.createTriplePatterns(
              table,
              columnNames,
              i,
              object
            );
            lines.push(...patterns.split('\n'));
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
