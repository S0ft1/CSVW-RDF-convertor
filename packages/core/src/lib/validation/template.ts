import { ValidationContext } from './context.js';
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

export function validateTemplate(
  template: CsvwTransformationDefinition,
  ctx: ValidationContext
) {
  if (!template || typeof template !== 'object') return;
  validateAllowedKeys(template, templateKeys, 'Template', ctx);
  validateType(template, 'Template', ctx);
}
