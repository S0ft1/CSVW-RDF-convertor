import { CsvwDialectDescription } from './dialect-description.js';
import { CsvwInheritedProperties } from './inherited-properties.js';
import { CsvwSchemaDescription } from './schema-description.js';
import { CsvwTableDescription } from './table.js';
import { CsvwTransformationDefinition } from './transformation-definition.js';

/**
 * A table group description is a JSON object that describes a group of tables.
 */
export interface CsvwTableGroupDescription extends CsvwInheritedProperties {
  /**
   * An array property of table descriptions for the tables in the group, namely those listed in the tables annotation on the group of tables being described.
   */
  tables: [CsvwTableDescription, ...CsvwTableDescription[]];
  /**
   * An object property that provides a single dialect description.
   */
  dialect?: CsvwDialectDescription;
  /**
   * An array property that provides an array of objects representing arbitrary annotations on the annotated group of tables.
   */
  notes?: unknown[];
  /**
   * An atomic property that must have a single string value that is one of "rtl", "ltr", or "auto". Indicates whether the tables in the group should be displayed with the first column on the right, on the left, or based on the first character in the table that has a specific direction.
   */
  tableDirection?: 'rtl' | 'ltr' | 'auto';
  /**
   * An object property that provides a single schema description as described in section 5.5 Schemas, used as the default for all the tables in the group.
   */
  tableSchema?: CsvwSchemaDescription;
  /**
   * An array property of transformation definitions that provide mechanisms to transform the tabular data into other formats.
   */
  transformations?: CsvwTransformationDefinition[];
  /**
   * If included, @id is a link property that identifies the group of tables, as defined by [tabular-data-model], described by this table group description. It must not start with _:.
   */
  '@id'?: string;
  /**
   * If included, @type is an atomic property that must be set to "TableGroup".
   */
  '@type'?: 'TableGroup';
}
