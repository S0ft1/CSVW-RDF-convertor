import { CsvwDatatype } from './datatype.js';

/**
 * Columns and cells may be assigned annotations based on properties on the description objects for groups of tables, tables, schemas, or columns. These properties are known as inherited properties and are listed below.
 */
export interface CsvwInheritedProperties {
  /**
   * A URI template property that may be used to indicate what a cell contains information about.
   */
  aboutUrl?: string;
  /**
   * An atomic property that contains either a single string that is the main datatype of the values of the cell or a datatype description object.
   */
  datatype?:
    | (
        | 'anyAtomicType'
        | 'anyURI'
        | 'base64Binary'
        | 'boolean'
        | 'date'
        | 'dateTime'
        | 'dateTimeStamp'
        | 'decimal'
        | 'integer'
        | 'long'
        | 'int'
        | 'short'
        | 'byte'
        | 'nonNegativeInteger'
        | 'positiveInteger'
        | 'unsignedLong'
        | 'unsignedInt'
        | 'unsignedShort'
        | 'unsignedByte'
        | 'nonPositiveInteger'
        | 'negativeInteger'
        | 'double'
        | 'duration'
        | 'dayTimeDuration'
        | 'yearMonthDuration'
        | 'float'
        | 'gDay'
        | 'gMonth'
        | 'gMonthDay'
        | 'gYear'
        | 'gYearMonth'
        | 'hexBinary'
        | 'QName'
        | 'string'
        | 'normalizedString'
        | 'token'
        | 'language'
        | 'Name'
        | 'NMTOKEN'
        | 'xml'
        | 'html'
        | 'json'
        | 'time'
        | 'number'
        | 'binary'
        | 'datetime'
        | 'any'
      )
    | CsvwDatatype;
  /**
   * An atomic property holding a single string that is used to create a default value for the cell in cases where the original string value is an empty string.
   */
  default?: string;
  /**
   * An atomic property giving a single string language code as defined by [BCP47]. Indicates the language of the value within the cell.
   */
  lang?: string;
  /**
   * An atomic property giving the string or strings used for null values within the data.
   */
  null?: string | string[];
  /**
   * A boolean atomic property taking a single value which indicates whether a list that is the value of the cell is ordered (if true) or unordered (if false).
   */
  ordered?: boolean;
  /**
   * A URI template property that may be used to create a URI for a property if the table is mapped to another format.
   */
  propertyUrl?: string;
  /**
   * A boolean atomic property taking a single value which indicates whether the cell value can be null.
   */
  required?: boolean;
  /**
   * An atomic property that must have a single string value that is the string used to separate items in the string value of the cell.
   */
  separator?: string;
  /**
   * An atomic property that must have a single string value that is one of "ltr", "rtl", "auto" or "inherit" (the default). Indicates whether the text within cells should be displayed as left-to-right text (ltr), as right-to-left text (rtl), according to the content of the cell (auto) or in the direction inherited from the table direction annotation of the table.
   */
  textDirection?: 'ltr' | 'rtl' | 'auto' | 'inherit';
  /**
   * A URI template property that is used to map the values of cells into URLs.
   */
  valueUrl?: string;
}
