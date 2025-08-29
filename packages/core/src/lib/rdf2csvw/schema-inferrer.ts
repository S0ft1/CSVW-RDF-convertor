import { Quad } from 'quadstore';
import { TableGroupSchema } from './schema/table-group-schema.js';
import { WindowStore } from './window-store.js';
import { OptionsWithDefaults } from './convertor.js';
import { NamedNode, Literal } from '@rdfjs/types';
import { TableSchema } from './schema/table-schema.js';
import { builtinDts, commonPrefixes } from '../utils/prefix.js';
import { DataFactory } from 'n3';
import { parseRdf } from '../loaders/parse.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from '../types/descriptor/datatype.js';
import { ColumnSchema } from './schema/column-schema.js';

const { rdf, skos } = commonPrefixes;
const { namedNode } = DataFactory;

export const UNKOWN_TYPE_TABLE = `unknown_type.csv`;
export const SUBJ_COL = 'subject_id';

export class SchemaInferrer {
  public schema = new TableGroupSchema();
  public unknownSchema: TableSchema;
  private loadedVocabs: string[] = [];

  constructor(
    private store: WindowStore,
    private options: OptionsWithDefaults,
    private prefLang = 'en',
  ) {}

  /**
   * Infers the schema from the RDF data in the store, consuming the whole underlying stream.
   */
  public async inferSchema() {
    for await (const quad of this.store.store.match()) {
      await this.addQuadToSchema(quad, true);
    }
    while (!this.store.done) {
      const [nextQuads] = await this.store.moveWindow();
      for (const quad of nextQuads) {
        await this.addQuadToSchema(quad, true);
      }
    }
    this.lockCurrentSchema();
  }

  /**
   * Incorporates a quad into the current schema.
   * @param quad - The quad to add.
   * @param addToUnknown - Whether to add to the unknown schema or skip the quad if it has no types.
   */
  public async addQuadToSchema(quad: Quad, addToUnknown = false) {
    const tables = await this.getSubjTables(quad);
    const colnamePrefix = quad.predicate.value.slice(
      Math.max(
        quad.predicate.value.lastIndexOf('#'),
        quad.predicate.value.lastIndexOf('/'),
      ) + 1,
    );
    const label = await this.getLabel(quad.predicate as NamedNode);
    const dtype = this.getDatatype(quad);

    if (tables.length === 0) {
      if (addToUnknown) {
        await this.addToUnknownSchema(quad, label, colnamePrefix, dtype);
      }
      return;
    }

    for (const table of tables) {
      await this.addToTable(quad, label, colnamePrefix, dtype, table);
    }
  }

  /**
   * Lock the current tables. If new quads are processed, they will create new tables instead of modifying the current ones.
   * @param lockTemplateUris - If locked, the template URIs will be fixed to {+colname} to be future proof.
   */
  public lockCurrentSchema(lockTemplateUris = false) {
    this.schema.lock();
    for (const table of this.schema.tables) {
      if (lockTemplateUris) {
        table.tableSchema.columns[0].aboutUrl = `{+${SUBJ_COL}}`;
      }
      const aboutUrl = table.tableSchema.columns[0].aboutUrl;
      for (let i = 1; i < table.tableSchema.columns.length; i++) {
        const col = table.tableSchema.columns[i];
        col.aboutUrl = aboutUrl;
        if (lockTemplateUris && col.valueUrl) {
          col.valueUrl = `{+${col.name}}`;
        }
      }
    }
  }

  /**
   * Adds a column to a table, creating a new table if there are multiple values for a single predicate or if the table is locked.
   * @param quad - The quad to process.
   * @param label - The label for the column.
   * @param colnamePrefix - The prefix for the column name.
   * @param dtype - The datatype of the column.
   * @param table - The table to add the column to.
   */
  private async addToTable(
    quad: Quad,
    label: string,
    colnamePrefix: string,
    dtype: CsvwDatatype | CsvwBuiltinDatatype,
    table: TableSchema,
  ) {
    if (quad.predicate.value === rdf + 'type') {
      this.updateAboutUrl(table, quad);
      return;
    }
    const relTable = await this.getRelTable(table, quad, colnamePrefix);
    const col = relTable.mergeColumn(
      this.getColName(relTable, colnamePrefix, quad.predicate.value),
      {
        datatype: dtype,
        titles: label,
        propertyUrl: quad.predicate.value,
      },
    );
    this.updateValueUrl(col, quad);
    this.updateAboutUrl(relTable, quad);
  }

  /**
   * Gets the table for a specific subject + predicate combination.
   */
  private async getRelTable(
    table: TableSchema,
    quad: Quad,
    colnamePrefix: string,
  ): Promise<TableSchema> {
    // table for this specific predicate on this specific class
    // used when the predicate can have multiple values
    let relTable = this.schema.tables.find(
      (t) =>
        t.tableSchema.columns.length === 2 &&
        t.tableSchema.columns[0].valueUrl ===
          table.tableSchema.columns[0].valueUrl &&
        t.tableSchema.columns[1].propertyUrl === quad.predicate.value,
    );
    const cannotModify =
      table.locked &&
      !table.tableSchema.columns.find(
        (col) => col.propertyUrl === quad.predicate.value,
      );
    if (!relTable || cannotModify) {
      if (cannotModify || (await this.hasMultipleValues(quad))) {
        relTable = this.schema.addTable(
          `${table.url.slice(0, -4)}_${colnamePrefix}${this.schema.tables.length}.csv`,
        );
        relTable.addColumn(SUBJ_COL, {
          titles: 'Subject ID',
          propertyUrl: rdf + 'type',
          valueUrl: table.tableSchema.columns[0].valueUrl,
          datatype: 'anyURI',
        });
        relTable.tableSchema.primaryKey = [SUBJ_COL, colnamePrefix + '1'];
      } else {
        relTable = table;
      }
    }
    return relTable;
  }

  private async hasMultipleValues(quad: Quad): Promise<boolean> {
    const arr = await this.store.store.get(
      {
        subject: quad.subject,
        predicate: quad.predicate,
        graph: quad.graph,
      },
      { limit: 2 },
    );
    return arr.items.length > 1;
  }

  private updateAboutUrl(table: TableSchema, quad: Quad) {
    const col = table.tableSchema.columns[0];
    col.aboutUrl = this.commonUriTemplate(
      col.aboutUrl || quad.subject.value,
      quad.subject.value,
      col.name,
    );
  }

  private updateValueUrl(col: ColumnSchema, quad: Quad) {
    if (
      quad.object.termType === 'NamedNode' ||
      quad.object.termType === 'BlankNode'
    ) {
      col.valueUrl = this.commonUriTemplate(
        col.valueUrl || quad.object.value,
        quad.object.value,
        col.name,
      );
    }
  }

  /**
   * Adds a column to the unknown schema.
   * @param quad - The quad to process.
   * @param label - The label for the column.
   * @param colnamePrefix - The prefix for the column name.
   * @param dtype - The datatype of the column.
   */
  private async addToUnknownSchema(
    quad: Quad,
    label: string,
    colnamePrefix: string,
    dtype: CsvwDatatype | CsvwBuiltinDatatype,
  ) {
    if (!this.unknownSchema) {
      this.unknownSchema = this.schema.addTable(UNKOWN_TYPE_TABLE);
      this.unknownSchema.addColumn(SUBJ_COL, {
        datatype: 'anyURI',
      });
      this.unknownSchema.addPrimaryKey(SUBJ_COL);
    }
    const relTable = await this.getRelTable(
      this.unknownSchema,
      quad,
      colnamePrefix,
    );
    const col = relTable.mergeColumn(
      this.getColName(relTable, colnamePrefix, quad.predicate.value),
      {
        datatype: dtype,
        propertyUrl: quad.predicate.value,
        titles: label,
      },
    );
    this.updateValueUrl(col, quad);
    this.updateAboutUrl(relTable, quad);
  }

  private getColName(table: TableSchema, colnamePrefix: string, iri: string) {
    let colIndex = table.tableSchema.columns.findIndex(
      (col) => col.propertyUrl === iri,
    );
    if (colIndex === -1) {
      colIndex = table.tableSchema.columns.length;
    }
    return colnamePrefix + colIndex;
  }

  private async getSubjTables(quad: Quad): Promise<TableSchema[]> {
    const types = (
      await this.store.store.get({
        subject: quad.subject,
        predicate: namedNode(rdf + 'type'),
        graph: quad.graph,
      })
    ).items;

    const tables: TableSchema[] = [];
    for (const typeQuad of types) {
      const label = await this.getLabel(typeQuad.object as NamedNode);
      const encoded = encodeURIComponent(label);
      let table = this.schema.getTable(encoded + '.csv');
      if (!table) {
        table = this.schema.addTable(encoded + '.csv');
        table.addColumn(SUBJ_COL, {
          datatype: 'anyURI',
          propertyUrl: rdf + 'type',
          valueUrl: quad.object.value,
        });
        table.addPrimaryKey(SUBJ_COL);
      }
      tables.push(table);
    }
    return tables;
  }

  private async getLabel(iri: NamedNode): Promise<string> {
    const iriSuffix = iri.value.slice(
      Math.max(iri.value.lastIndexOf('#'), iri.value.lastIndexOf('/')) + 1,
    );
    if (!this.options.useVocabMetadata) return iriSuffix;

    await this.loadVocab(iri.value);
    let offlangLabel: string | null = null;
    for (const pred of [skos + 'prefLabel', rdf + 'label']) {
      const labelQuads = await this.store.store.get({
        subject: iri,
        predicate: namedNode(pred),
      });
      for (const labelQuad of labelQuads.items) {
        const obj = labelQuad.object as Literal;
        if (
          obj.language === this.prefLang ||
          obj.language.startsWith(this.prefLang + '-')
        ) {
          return obj.value;
        } else if (!obj.language && !offlangLabel) {
          offlangLabel = obj.value;
        }
      }
      if (!offlangLabel && labelQuads.items.length > 0) {
        offlangLabel = labelQuads.items[0].object.value;
      }
    }

    return offlangLabel || iriSuffix;
  }

  private async loadVocab(iri: string) {
    const vocabIri = iri.slice(
      0,
      Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')),
    );
    if (this.loadedVocabs.includes(vocabIri)) return;
    this.loadedVocabs.push(vocabIri);

    try {
      await this.store.store.putStream(
        await parseRdf(vocabIri, {
          baseIri: this.options.baseIri,
          resolveStreamFn: this.options.resolveRdfFn,
        }),
      );
    } catch {
      return;
    }
  }

  private getDatatype(quad: Quad): CsvwDatatype | CsvwBuiltinDatatype {
    const obj = quad.object;
    if (obj.termType === 'NamedNode' || obj.termType === 'BlankNode') {
      return 'anyURI';
    }
    if (obj.termType === 'Literal') {
      const dtype = obj.datatype?.value;
      return builtinDts[dtype] || 'anyAtomicType';
    }
    throw new Error('Unknown term type: ' + obj.termType);
  }

  private commonUriTemplate(
    curTemplate: string,
    nextIri: string,
    colName: string,
  ): string {
    let commonPrefix = '';
    for (
      let i = 0;
      i < curTemplate.length &&
      curTemplate[i] !== '{' &&
      curTemplate[i] === nextIri[i];
      i++
    ) {
      commonPrefix += curTemplate[i];
    }
    let commonSuffix = '';
    for (
      let i = 0;
      i < curTemplate.length - commonPrefix.length &&
      curTemplate.at(-i - 1) !== '}' &&
      curTemplate.at(-i - 1) === nextIri.at(-i - 1);
      i++
    ) {
      commonSuffix = curTemplate.at(-i - 1) + commonSuffix;
    }

    if (commonPrefix.length === curTemplate.length) return curTemplate;
    if (
      curTemplate[commonPrefix.length + 1] === '+' ||
      nextIri
        .slice(commonPrefix.length, -commonSuffix.length)
        .match(/[/?&=#[\]{}]/)
    ) {
      return `${commonPrefix}{+${colName}}${commonSuffix}`;
    }
    return `${commonPrefix}{${colName}}${commonSuffix}`;
  }
}
