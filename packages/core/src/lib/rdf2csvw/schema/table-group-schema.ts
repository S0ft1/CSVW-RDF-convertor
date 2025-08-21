import { CsvwTableGroupDescription } from '../../types/descriptor/table-group.js';
import { TableSchema } from './table-schema.js';

export class TableGroupSchema implements CsvwTableGroupDescription {
  public tables: [TableSchema, ...TableSchema[]];

  public addTable(url: string, ...columns: string[]): TableSchema {
    if (this.tables?.some((table) => table.url === url))
      throw new Error('Cannot add table with an existing name');

    const table = new TableSchema(url, ...columns);
    if (this.tables === undefined) this.tables = [table];
    else this.tables.push(table);
    return table;
  }

  public getTable(url: string): TableSchema | undefined {
    return this.tables?.find((table) => table.url === url);
  }

  public mergeTables(a: string, b: string) {
    throw new Error('Method not implemented.');
  }
  public renameTable(oldName: string, newName: string) {
    throw new Error('Method not implemented.');
  }
  public removeTable(name: string) {
    throw new Error('Method not implemented.');
  }
  public renameTableCol(table: string, oldName: string, newName: string) {
    throw new Error('Method not implemented.');
  }
  public removeTableCol(table: string, name: string) {
    throw new Error('Method not implemented.');
  }
}
