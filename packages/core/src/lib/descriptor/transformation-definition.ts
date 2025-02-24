/**
 * A transformation definition is a definition of how tabular data can be transformed into another format using a script or template.
 */
export interface CsvwTransformationDefinition {
  /**
   * A link property giving the single URL of the file that the script or template is held in, relative to the location of the metadata document.
   */
  url: string;
  /**
   * A link property giving the single URL for the format that is used by the script or template.
   */
  scriptFormat: string;
  /**
   * A link property giving the single URL for the format that will be created through the transformation.
   */
  targetFormat: string;
  /**
   * A single string atomic property that provides, if specified, the format to which the tabular data should be transformed prior to the transformation using the script or template.
   */
  source?: string | null;
  /**
   * A natural language property that describes the format that will be generated from the transformation. This is useful if the target format is a generic format (such as application/json) and the transformation is creating a specific profile of that format.
   */
  titles?:
    | string
    | unknown[]
    | {
        [k: string]: unknown;
      };
  /**
   * If included, @id is a link property that identifies the transformation described by this transformation definition. It must not start with _:.
   */
  '@id'?: string;
  /**
   * If included, @type is an atomic property that must be set to "Template".
   */
  '@type'?: 'Template';
}
