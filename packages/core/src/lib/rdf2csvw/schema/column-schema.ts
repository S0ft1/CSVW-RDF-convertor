import { CsvwColumnDescription } from '../../types/descriptor/column-description.js';

export class ColumnSchema implements CsvwColumnDescription {
  public name: string;

  public required?: boolean;

  public aboutUrl?: string;
  public propertyUrl?: string;
  public valueUrl?: string;

  constructor(name: string) {
    this.name = name;
  }

  public renameColumn(name: string) {
    this.name = name;
  }
}
