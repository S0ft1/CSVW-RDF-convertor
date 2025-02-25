/**
 * A dialect description provides hints to parsers about how to parse the file linked to from the url property in a table description.
 */
export interface CsvwDialectDescription {
  /**
   * An atomic property that sets the comment prefix flag to the single provided value, which must be a string.
   */
  commentPrefix?: string;
  /**
   * An atomic property that sets the delimiter flag to the single provided value, which must be a string.
   */
  delimiter?: string;
  /**
   * A boolean atomic property that, if true, sets the escape character flag to ". If false, to \.
   */
  doubleQuote?: boolean;
  /**
   * An atomic property that sets the encoding flag to the single provided string value, which must be a defined in [encoding].
   */
  encoding?: string;
  /**
   * A boolean atomic property that, if true, sets the header row count flag to 1, and if false to 0, unless headerRowCount is provided, in which case the value provided for the header property is ignored.
   */
  header?: boolean;
  /**
   * A numeric atomic property that sets the header row count flag to the single provided value, which must be a non-negative integer.
   */
  headerRowCount?: number;
  /**
   * An atomic property that sets the line terminators flag to either an array containing the single provided string value, or the provided array.
   */
  lineTerminators?: string | string[];
  /**
   * An atomic property that sets the quote character flag to the single provided value, which must be a string or null. If the value is null, the escape character flag is also set to null.
   */
  quoteChar?: string | null;
  /**
   * A boolean atomic property that sets the skip blank rows flag to the single provided boolean value.
   */
  skipBlankRows?: boolean;
  /**
   * A numeric atomic property that sets the skip columns flag to the single provided numeric value, which must be a non-negative integer.
   */
  skipColumns?: number;
  /**
   * A boolean atomic property that, if true, sets the trim flag to "start" and if false, to false. If the trim property is provided, the skipInitialSpace property is ignored.
   */
  skipInitialSpace?: boolean;
  /**
   * A numeric atomic property that sets the skip rows flag to the single provided numeric value, which must be a non-negative integer.
   */
  skipRows?: number;
  /**
   * An atomic property that, if the boolean true, sets the trim flag to true and if the boolean false to false. If the value provided is a string, sets the trim flag to the provided value, which must be one of "true", "false", "start", or "end".
   */
  trim?: boolean | ('true' | 'false' | 'start' | 'end');
  /**
   * If included, @id is a link property that identifies the dialect described by this dialect description. It must not start with _:.
   */
  '@id'?: string;
  /**
   * If included, @type is an atomic property that must be set to "Dialect". Publishers may include this to provide additional information to JSON-LD based toolchains.
   */
  '@type'?: 'Dialect';
}
