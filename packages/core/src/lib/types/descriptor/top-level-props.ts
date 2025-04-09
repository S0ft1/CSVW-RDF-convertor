import { AnyOf } from './expanded.js';
import { csvwNs } from './namespace.js';

/**
 * The top-level object of a metadata document or object referenced through an object property (whether it is a table group description, table description, schema, dialect description or transformation definition) must have a \@context property.
 */
export interface CsvwTopLevelProperties {
  '@context'?:
    | typeof csvwNs
    | [
        typeof csvwNs,
        AnyOf<{
          '@base'?: string;
          '@language'?: string;
        }>
      ];
}
