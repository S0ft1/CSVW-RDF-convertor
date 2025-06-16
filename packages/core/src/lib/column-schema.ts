import { CsvwColumnDescription } from './types/descriptor/column-description.js';

export class ColumnSchema implements CsvwColumnDescription {
  private _name: string;
  public get name() {
    return this._name as Readonly<string>;
  }

  constructor(name: string) {
    this._name = name;
  }

  public renameColumn(name: string) {
    this._name = name;
  }
}
