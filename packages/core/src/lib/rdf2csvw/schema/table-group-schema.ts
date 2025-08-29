import { CsvwTableGroupDescription } from '../../types/descriptor/table-group.js';
import { ColumnSchema } from './column-schema.js';
import { TableSchema } from './table-schema.js';

export class TableGroupSchema implements CsvwTableGroupDescription {
  public tables: [TableSchema, ...TableSchema[]] = [] as unknown as [
    TableSchema,
    ...TableSchema[],
  ];

  public addTable(url: string, ...columns: string[]): TableSchema {
    if (this.tables?.some((table) => table.url === url))
      throw new Error('Cannot add table with an existing url: ' + url);

    const table = new TableSchema(url, ...columns);
    if (this.tables === undefined) this.tables = [table];
    else this.tables.push(table);
    return table;
  }

  public getTable(url: string): TableSchema | undefined {
    return this.tables?.find((table) => table.url === url);
  }

  public renameTable(oldUrl: string, newUrl: string) {
    if (this.tables?.some((table) => table.url === newUrl))
      throw new Error('Cannot rename table to an existing url: ' + newUrl);

    const table = this.getTable(oldUrl);
    if (!table) throw new Error('Table not found: ' + oldUrl);

    table.url = newUrl;
  }
  public removeTable(url: string) {
    if (this.tables.length === 1) {
      throw new Error('Cannot remove the only table in the group');
    }
    this.tables = this.tables.filter((table) => table.url !== url) as [
      TableSchema,
      ...TableSchema[],
    ];
    for (const table of this.tables) {
      table.tableSchema.foreignKeys = table.tableSchema.foreignKeys.filter(
        (fk) => fk.reference.resource !== url,
      );
    }
  }
  public renameTableCol(table: string, name: string, newTitle: string) {
    const t = this.getTable(table);
    if (!t) throw new Error('Table not found: ' + table);
    t.renameColumn(name, newTitle);
  }
  public removeTableCol(table: string, name: string) {
    const t = this.getTable(table);
    if (!t) throw new Error('Table not found: ' + table);
    t.removeColumn(name);
  }
  public moveTableCol(fromTable: string, column: string, toTable: string) {
    const from = this.getTable(fromTable);
    if (!from) throw new Error('Table not found: ' + fromTable);
    const to = this.getTable(toTable);
    if (!to) throw new Error('Table not found: ' + toTable);
    const col = from.getColumn(column);
    if (!col) throw new Error('Column not found: ' + column);

    const cols: ColumnSchema[] = [];

    for (const pk of from.tableSchema.primaryKey) {
      const pkCol = from.getColumn(pk)!;
      if (pkCol === col)
        throw new Error('Cannot move primary key column: ' + pk);
      cols.push(pkCol.clone());
    }
    cols.push(col);

    from.removeColumn(column);
    for (const addC of cols) {
      if (
        !to.tableSchema.columns.find((c) => c.propertyUrl === addC.propertyUrl)
      ) {
        while (to.getColumn(addC.name)) {
          addC.name = addC.name + to.tableSchema.columns.length;
        }
        to.addColumn(addC.name, addC);
        if (!to.tableSchema.primaryKey.includes(addC.name)) {
          to.tableSchema.primaryKey.push(addC.name);
        }
      }
    }
  }

  public clone() {
    const clone = new TableGroupSchema();
    clone.tables = this.tables?.map((table) => table.clone()) as [
      TableSchema,
      ...TableSchema[],
    ];
    return clone;
  }

  /**
   * Locks the current tables, preventing them from being extended.
   */
  public lock() {
    this.tables?.forEach((table) => (table.locked = true));
  }
}
