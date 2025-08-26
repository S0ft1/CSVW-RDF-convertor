import {
  CsvwBuiltinDatatype,
  CsvwDatatype,
} from 'src/lib/types/descriptor/datatype.js';
import { CsvwColumnDescription } from '../../types/descriptor/column-description.js';

export class ColumnSchema implements CsvwColumnDescription {
  public name: string;

  public required?: boolean;

  public aboutUrl?: string;
  public propertyUrl?: string;
  public valueUrl?: string;
  public titles: string;

  public datatype: CsvwBuiltinDatatype | CsvwDatatype = 'anyAtomicType';

  constructor(name: string) {
    this.name = name;
  }

  public renameColumn(name: string) {
    this.name = name;
  }

  public clone() {
    const clone = new ColumnSchema(this.name);
    clone.required = this.required;
    clone.aboutUrl = this.aboutUrl;
    clone.propertyUrl = this.propertyUrl;
    clone.valueUrl = this.valueUrl;
    clone.datatype = structuredClone(this.datatype);
    return clone;
  }
}
