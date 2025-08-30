import { CsvwTableDescription } from '../../types/descriptor/table.js';
import { CsvwForeignKeyDefinition } from '../../types/descriptor/schema-description.js';
import { ColumnSchema } from '../../rdf2csvw/schema/column-schema.js';
import { CsvwColumnDescription } from '../../types/descriptor/column-description.js';
import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from '../../types/descriptor/datatype.js';
import { isEqual } from 'es-toolkit';
import { findObjectPath } from '../../utils/find-object-path.js';
import { dtTree } from '../../utils/prefix.js';

export type ColumnOptions = Partial<
  Pick<
    ColumnSchema,
    Extract<keyof CsvwColumnDescription, keyof Omit<ColumnSchema, 'name'>>
  >
>;

export class TableSchema implements CsvwTableDescription {
  public url: string;
  public locked = false;

  public tableSchema: {
    columns: ColumnSchema[];
    foreignKeys: CsvwForeignKeyDefinition[];
    primaryKey: string[];
  };

  constructor(url: string, ...columns: string[]) {
    this.url = url;
    this.tableSchema = {
      columns: [],
      foreignKeys: [],
      primaryKey: [],
    };

    for (const columnName of columns) {
      this.addColumn(columnName);
    }
  }

  public getColumn(name: string): ColumnSchema | undefined {
    return this.tableSchema.columns.find((column) => column.name === name);
  }

  public addColumn(name: string, options?: ColumnOptions): ColumnSchema {
    if (this.tableSchema.columns.some((column) => column.name === name)) {
      throw new Error('Cannot add column with an existing name');
    }

    const column = new ColumnSchema(name);
    for (const key in options ?? {}) {
      (column as any)[key] = (options as any)[key];
    }
    this.tableSchema.columns.push(column);
    return column;
  }

  public mergeColumn(name: string, options?: ColumnOptions): ColumnSchema {
    let col = this.getColumn(name);
    if (!col) {
      col = this.addColumn(name, options);
      return col;
    }

    for (const key in options ?? {}) {
      if (key === 'datatype') {
        col.datatype = this.mergeDatatype(col.datatype, (options as any)[key]);
      }
      (col as any)[key] = (options as any)[key];
    }
    return col;
  }

  /**
   * Merges two datatypes into a single datatype.
   * @param aDatatype The first datatype.
   * @param bDatatype The second datatype.
   * @returns The merged datatype.
   */
  private mergeDatatype(
    aDatatype: CsvwDatatype | CsvwBuiltinDatatype,
    bDatatype: CsvwDatatype | CsvwBuiltinDatatype,
  ): CsvwDatatype | CsvwBuiltinDatatype {
    if (typeof aDatatype === 'object' && typeof bDatatype === 'object') {
      if (isEqual(aDatatype, bDatatype)) return aDatatype;
    }
    const a =
      typeof aDatatype === 'object'
        ? (aDatatype.base ?? 'anyAtomicType')
        : aDatatype;
    const b =
      typeof bDatatype === 'object'
        ? (bDatatype.base ?? 'anyAtomicType')
        : bDatatype;
    if (a === b) return a;

    const aPath = findObjectPath(dtTree, a);
    const bPath = findObjectPath(dtTree, b);
    if (!aPath || !bPath) return 'anyAtomicType';
    if (aPath.path.length > bPath.path.length) {
      aPath.path = aPath.path.slice(0, bPath.path.length);
    } else if (bPath.path.length > aPath.path.length) {
      bPath.path = bPath.path.slice(0, aPath.path.length);
    }

    while (
      aPath.values[aPath.path.length] !== bPath.values[bPath.path.length]
    ) {
      aPath.path.pop();
      bPath.path.pop();
    }
    return aPath.path.at(-1) as CsvwBuiltinDatatype;
  }

  public removeColumn(name: string) {
    if (this.tableSchema.primaryKey.some((key) => key === name)) {
      throw new Error('Cannot remove a column that is part of the primary key');
    }

    this.tableSchema.columns = this.tableSchema.columns.filter(
      (column) => column.name !== name,
    );
    this.tableSchema.foreignKeys = this.tableSchema.foreignKeys.filter((fk) => {
      const arr = Array.isArray(fk.columnReference)
        ? fk.columnReference
        : [fk.columnReference];
      return !arr.includes(name);
    });
  }

  public renameColumn(name: string, newTitle: string) {
    const column = this.tableSchema.columns.find(
      (column) => column.name === name,
    );
    if (column === undefined) {
      throw new Error('Column not found');
    }

    column.titles = newTitle;
  }

  public addPrimaryKey(columnName: string) {
    if (!this.tableSchema.columns.some((column) => column.name === columnName))
      throw new Error('Column with the given name does not exists');
    if (this.tableSchema.primaryKey.some((key) => key === columnName))
      throw new Error('Column is already part of the primary key');

    this.tableSchema.primaryKey.push(columnName);
  }

  public removePrimaryKey(columnName: string) {
    if (!this.tableSchema.primaryKey.some((key) => key === columnName))
      throw new Error('Column is not part of the primary key');

    this.tableSchema.primaryKey = this.tableSchema.primaryKey.filter(
      (key) => key !== columnName,
    );
  }

  public clone() {
    const clone = new TableSchema(this.url);
    clone.url = this.url;
    clone.locked = this.locked;
    clone.tableSchema = {
      columns: this.tableSchema.columns.map((col) => col.clone()),
      foreignKeys: structuredClone(this.tableSchema.foreignKeys),
      primaryKey: [...this.tableSchema.primaryKey],
    };
    return clone;
  }
}
