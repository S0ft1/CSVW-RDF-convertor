export type CsvwBuiltinDatatype =
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
  | 'any';

/**
 * A dialect description provides hints to parsers about how to parse the file linked to from the url property in a table description.
 */
export interface CsvwDatatype {
  /**
   * An atomic property that contains a single string: the name of one of the built-in datatypes, as listed above (and which are defined as terms in the default context).
   */
  base?: CsvwBuiltinDatatype;
  /**
   * An atomic property that contains either a single string or an object that defines the format of a value of this type, used when parsing a string value as described in Parsing Cells in [tabular-data-model].
   */
  format?: string | CsvwNumberFormat;
  /**
   * A numeric atomic property that contains a single integer that is the exact length of the value.
   */
  length?: number;
  /**
   * An atomic property that contains a single integer that is the minimum length of the value.
   */
  minLength?: number;
  /**
   * A numeric atomic property that contains a single integer that is the maximum length of the value.
   */
  maxLength?: number;
  /**
   * An atomic property that contains a single number or string that is the minimum valid value (inclusive); equivalent to minInclusive.
   */
  minimum?: number | string;
  /**
   * An atomic property that contains a single number or string that is the maximum valid value (inclusive); equivalent to maxInclusive.
   */
  maximum?: number | string;
  /**
   * An atomic property that contains a single number or string that is the minimum valid value (inclusive).
   */
  minInclusive?: number | string;
  /**
   * An atomic property that contains a single number or string that is the maximum valid value (inclusive).
   */
  maxInclusive?: number | string;
  /**
   * An atomic property that contains a single number or string that is the minimum valid value (exclusive).
   */
  minExclusive?: number | string;
  /**
   * An atomic property that contains a single number or string that is the maximum valid value (exclusive).
   */
  maxExclusive?: number | string;
  /**
   * If included, @id is a link property that identifies the datatype described by this datatype description. It must not start with _: and it must not be the URL of a built-in datatype.
   */
  '@id'?: string;
  /**
   * If included, @type is an atomic property that must be set to "Datatype".
   */
  '@type'?: 'Datatype';
}
/**
 * If the datatype base is a numeric type, the datatype format annotation indicates the expected format for that number. Its value must be either a single string or an object with one or more of the properties:
 */
export interface CsvwNumberFormat {
  /**
   * A string whose value is used to represent a decimal point within the number.
   */
  decimalChar?: string;
  /**
   * A string whose value is used to group digits within the number.
   */
  groupChar?: string;
  /**
   * A number format pattern as defined in [UAX35].
   */
  pattern?: string;
}
