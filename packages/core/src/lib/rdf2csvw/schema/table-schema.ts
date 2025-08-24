import { CsvwTableDescription } from '../../types/descriptor/table.js';
import { CsvwForeignKeyDefinition } from '../../types/descriptor/schema-description.js';
import { ColumnSchema } from '../../rdf2csvw/schema/column-schema.js';

export class TableSchema implements CsvwTableDescription {
  public url: string;

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

  public addColumn(name: string): ColumnSchema {
    if (this.tableSchema.columns.some((column) => column.name === name)) {
      throw new Error('Cannot add column with an existing name');
    }

    const column = new ColumnSchema(name);
    this.tableSchema.columns.push(column);
    return column;
  }

  /** you need to verify foreign keys integrity yourself */
  public removeColumn(name: string) {
    if (this.tableSchema.primaryKey.some((key) => key === name)) {
      throw new Error('Cannot remove a column that is part of the primary key');
    }

    this.tableSchema.columns = this.tableSchema.columns.filter(
      (column) => column.name !== name,
    );
  }

  /** you need to verify foreign keys integrity yourself */
  public renameColumn(oldName: string, newName: string) {
    if (this.tableSchema.columns.some((column) => column.name === newName)) {
      throw new Error('Cannot rename to an existing column');
    }

    const column = this.tableSchema.columns.find(
      (column) => column.name === oldName,
    );
    if (column === undefined) {
      throw new Error('Column not found');
    }

    column.renameColumn(newName);

    const i = this.tableSchema.primaryKey.indexOf(oldName);
    if (i !== -1) {
      this.tableSchema.primaryKey[i] = newName;
    }
  }

  public addForeignKey() {
    // TODO: implement method
    throw new Error('Method not implemented.');
  }

  public removeForeignKey() {
    // TODO: implement method
    throw new Error('Method not implemented.');
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
}
