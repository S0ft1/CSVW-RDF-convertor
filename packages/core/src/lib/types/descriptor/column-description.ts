import { CsvwDatatype, CsvwNumberFormat } from './datatype.js';
import { CsvwInheritedProperties } from './inherited-properties.js';

/**
 * A column description is a JSON object that describes a single column. The description provides additional human-readable documentation for a column, as well as additional information that may be used to validate the cells within the column, create a user interface for data entry, or inform conversion into other formats.
 */
export interface CsvwColumnDescription extends CsvwInheritedProperties {
  /**
   * An atomic property that gives a single canonical name for the column.
   */
  name?: string;
  /**
   * A boolean atomic property. If true, suppresses any output that would be generated when converting cells in this column.
   */
  suppressOutput?: boolean;
  /**
   * A natural language property that provides possible alternative names for the column.
   */
  titles?:
    | string
    | string[]
    | {
        [k: string]: string | string[];
      };
  /**
   * A boolean atomic property taking a single value which indicates whether the column is a virtual column not present in the original source.
   */
  virtual?: boolean;
  /**
   * If included, \@id is a link property that identifies the columns, as defined in [tabular-data-model], and potentially appearing across separate tables, described by this column description. It must not start with _:.
   */
  '@id'?: string;
  /**
   * If included, \@type is an atomic property that must be set to "Column". Publishers may include this to provide additional information to JSON-LD based toolchains.
   */
  '@type'?: 'Column';
}
type DataTypeWithFormat = CsvwDatatype & Required<Pick<CsvwDatatype,'format'>>
type NumberDataType = Omit<DataTypeWithFormat, 'format'> & { format: CsvwNumberFormat }

export type ColumnDescriptionWithNumberDataTypeAndFormat = CsvwColumnDescription & Required<Pick<CsvwInheritedProperties, 'datatype'>> & { datatype: NumberDataType }

type DateDataType = Omit<DataTypeWithFormat, 'format'> & { format: string }
export type ColumnDescriptionWithDateDataTypeAndFormat = CsvwColumnDescription & Required<Pick<CsvwInheritedProperties, 'datatype'>> & { datatype: DateDataType }
