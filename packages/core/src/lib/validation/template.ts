import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import { CsvwTransformationDefinition } from '../types/descriptor/transformation-definition.js';
import { validateAllowedKeys, validateIdAndType } from './generic.js';

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

export function validateTemplate(
  template: CsvwTransformationDefinition,
  ctx: Csvw2RdfContext
) {
  if (!template || typeof template !== 'object') return;
  validateAllowedKeys(template, templateKeys, 'Template', ctx);
  validateIdAndType(template, 'Template', ctx);
}
