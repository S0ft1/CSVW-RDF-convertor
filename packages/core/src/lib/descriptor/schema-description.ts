import { CsvwColumnDescription } from './column-description.js';

/**
 * A schema description is a JSON object that encodes the information about a schema, which describes the structure of a table.
 */
export interface CsvwSchemaDescription {
  /**
   * An array property of column descriptions as described in section 5.6 Columns. These are matched to columns in tables that use the schema by position: the first column description in the array applies to the first column in the table, the second to the second and so on.
   */
  columns?: CsvwColumnDescription[];
  /**
   * An array property of foreign key definitions that define how the values from specified columns within this table link to rows within this table or other tables.
   */
  foreignKeys?: CsvwForeignKeyDefinition[];
  /**
   * A column reference property that holds either a single reference to a column description object or an array of references.
   */
  primaryKey?: string | string[];
  /**
   * A column reference property that holds either a single reference to a column description object or an array of references. The value of this property determines the titles annotation for each row within a table that uses this schema.
   */
  rowTitles?: string | string[];
  /**
   * If included, @id is a link property that identifies the schema described by this schema description. It must not start with _:.
   */
  '@id'?: string;
  /**
   * If included, @type is an atomic property that must be set to "Schema".
   */
  '@type'?: 'Schema';
}
/**
 * A foreign key definition is a JSON object that must contain only the following properties:
 */
export interface CsvwForeignKeyDefinition {
  /**
   * A column reference property that holds either a single reference to a column description object within this schema, or an array of references. These form the referencing columns for the foreign key definition.
   */
  columnReference?: string | string[];
  reference?: CsvwForeignKeyReference;
}
/**
 * An object property that identifies a referenced table and a set of referenced columns within that table.
 */
export interface CsvwForeignKeyReference {
  /**
   * A link property holding a URL that is the identifier for a specific table that is being referenced.
   */
  resource?: string;
  /**
   * A link property holding a URL that is the identifier for a schema that is being referenced.
   */
  schemaReference?: string;
  /**
   * A column reference property that holds either a single reference (by name) to a column description object within the tableSchema of the referenced table, or an array of such references.
   */
  columnReference?: string | string[];
}
