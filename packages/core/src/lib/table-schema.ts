import { CsvwTableDescription } from './types/descriptor/table.js';
import { CsvwForeignKeyDefinition } from './types/descriptor/schema-description.js';
import { ColumnSchema } from './column-schema.js';

export class TableSchema implements CsvwTableDescription {
  private _url: string;
  public get url() {
    return this._url as Readonly<string>;
  }

  private _tableSchema: {
    columns: ColumnSchema[];
    foreignKeys: CsvwForeignKeyDefinition[];
    primaryKey: string[];
  };

  constructor(url: string) {
    this._url = url + '.csv';
  }

  public addColumns(...columns: string[]) {
    if (
      this._tableSchema.columns.some((column) => columns.includes(column.name))
    ) {
      throw new Error('Cannot add column with an existing name');
    }

    for (const columnName of columns) {
      this._tableSchema.columns.push(new ColumnSchema(columnName));
    }
  }

  /** you need to verify foreign keys integrity yourself */
  public removeColumns(...columns: string[]) {
    if (this._tableSchema.primaryKey.some((key) => columns.includes(key))) {
      throw new Error('Cannot remove a column that is part of the primary key');
    }

    this._tableSchema.columns = this._tableSchema.columns.filter(
      (column) => !columns.includes(column.name)
    );
  }

  /** you need to verify foreign keys integrity yourself */
  public renameColumn(oldName: string, newName: string) {
    if (this._tableSchema.columns.some((column) => column.name === newName)) {
      throw new Error('Cannot rename to an existing column');
    }

    const column = this._tableSchema.columns.find(
      (column) => column.name === oldName
    );
    if (column === undefined) {
      throw new Error('Column not found');
    }

    column.renameColumn(newName);

    const i = this._tableSchema.primaryKey.indexOf(oldName);
    if (i !== -1) {
      this._tableSchema.primaryKey[i] = newName;
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
    if (!this._tableSchema.columns.some((column) => column.name === columnName))
      throw new Error('Column with the given name does not exists');
    if (this._tableSchema.primaryKey.some((key) => key === columnName))
      throw new Error('Column is already part of the primary key');

    this._tableSchema.primaryKey.push(columnName);
  }

  public removePrimaryKey(columnName: string) {
    if (!this._tableSchema.primaryKey.some((key) => key === columnName))
      throw new Error('Column is not part of the primary key');

    this._tableSchema.primaryKey = this._tableSchema.primaryKey.filter(
      (key) => key !== columnName
    );
  }
}
