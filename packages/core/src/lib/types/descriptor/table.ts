import { CsvwDialectDescription } from './dialect-description.js';
import { CsvwInheritedProperties } from './inherited-properties.js';
import { CsvwSchemaDescription } from './schema-description.js';
import { CsvwTransformationDefinition } from './transformation-definition.js';

/**
 * A table description is a JSON object that describes a table within a CSV file.
 */
export interface CsvwTableDescription extends CsvwInheritedProperties {
  /**
   * This link property gives the single URL of the CSV file that the table is held in, relative to the location of the metadata document.
   */
  url: string;
  /**
   * An object property that provides a single dialect description.
   */
  dialect?: CsvwDialectDescription;
  /**
   * An array property that provides an array of objects representing arbitrary annotations on the annotated group of tables.
   */
  notes?: unknown[] | unknown;
  /**
   * A boolean atomic property. If true, suppresses any output that would be generated when converting this table.
   */
  suppressOutput?: boolean;
  /**
   * An atomic property that must have a single string value that is one of "rtl", "ltr", or "auto". Indicates whether the tables in the group should be displayed with the first column on the right, on the left, or based on the first character in the table that has a specific direction.
   */
  tableDirection?: 'rtl' | 'ltr' | 'auto';
  /**
   * An object property that provides a single schema description as described in section 5.5 Schemas, used as the default for all the tables in the group. This may be provided as an embedded object within the JSON metadata or as a URL reference to a separate JSON object that is a schema description.
   */
  tableSchema?: CsvwSchemaDescription;
  /**
   * An array property of transformation definitions that provide mechanisms to transform the tabular data into other formats.
   */
  transformations?: CsvwTransformationDefinition[];
  /**
   * If included, \@id is a link property that identifies the table, as defined in [tabular-data-model], described by this table description. It must not start with _:.
   */
  '@id'?: string;
  /**
   * If included, \@type is an atomic property that must be set to "Table".
   */
  '@type'?: 'Table';
}
