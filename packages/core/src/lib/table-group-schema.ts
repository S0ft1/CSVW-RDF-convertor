import { TableSchema } from './table-schema.js';

export class TableGroupSchema {
  public tables = new Map<string, TableSchema>();

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
