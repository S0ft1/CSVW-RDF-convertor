import { MultiMap } from 'mnemonist';

export class TableSchema {
  private _columns: string[] = [];
  public get columns() {
    return this._columns as ReadonlyArray<string>;
  }

  public primaryKey = new Set<string>();
  public readonly foreignKeys = new MultiMap<string, Map<string, string>>(Set);

  constructor(public name: string) {}

  public addColumns(...columns: string[]) {
    if (this._columns.some((column) => columns.includes(column)))
      throw new Error('Cannot add column with an existing name');
    this._columns.push(...columns);
  }

  /** you need to verify foreign keys integrity yourself */
  public removeColumns(...columns: string[]) {
    if (columns.some((column) => this.primaryKey.has(column))) {
      throw new Error('Cannot remove a column that is part of the primary key');
    }
    this._columns = this._columns.filter((column) => !columns.includes(column));
  }

  /** you need to verify foreign keys integrity yourself */
  public renameColumn(oldName: string, newName: string) {
    if (this.columns.includes(newName)) {
      throw new Error('Cannot rename to an existing column');
    }

    const i = this._columns.indexOf(oldName);
    if (i === -1) {
      throw new Error('Column not found');
    }
    this._columns[i] = newName;

    if (this.primaryKey.delete(oldName)) {
      this.primaryKey.add(newName);
    }
  }
}
