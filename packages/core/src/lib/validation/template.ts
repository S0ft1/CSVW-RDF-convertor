
import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import { CsvwTransformationDefinition } from '../types/descriptor/transformation-definition.js';
import { validateAllowedKeys, validateType } from './generic.js';

const templateKeys = [
  'notes',
  'url',
  'scriptFormat',
  'targetFormat',
  'source',
  'titles',
  '@id',
  '@type',
];

/**
 * Validates a template object against the allowed keys and type constraints
 * for a "Template" in the CSVW-RDF conversion context.
 *
 * @param template - The template object to validate. This should conform to
 * the `CsvwTransformationDefinition` interface.
 * @param ctx - The context object of type `Csvw2RdfContext` that provides
 * additional validation utilities and context-specific information.
 */
export function validateTemplate(
  template: CsvwTransformationDefinition,
  ctx: Csvw2RdfContext
) {
  if (!template || typeof template !== 'object') return;
  validateAllowedKeys(template, templateKeys, 'Template', ctx);
  validateType(template, 'Template', ctx);
}
