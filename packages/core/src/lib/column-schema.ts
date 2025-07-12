import { CsvwColumnDescription } from './types/descriptor/column-description.js';

export class ColumnSchema implements CsvwColumnDescription {
  public name: string;

  public required?: boolean | undefined;

  public aboutUrl: string | undefined;

  public propertyUrl: string | undefined;

  public valueUrl: string | undefined;

  constructor(name: string) {
    this.name = name;
  }

  public renameColumn(name: string) {
    this.name = name;
  }
}
