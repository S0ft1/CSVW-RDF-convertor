import { CsvwInheritedProperties } from '../types/descriptor/inherited-properties.js';
import { validateDatatype } from './datatype.js';
import { PropertySchema, validateLang, validateObject } from './generic.js';
import { ValidationContext } from './context.js';

const inheritedPropertiesSchema: Partial<
  Record<keyof CsvwInheritedProperties, PropertySchema>
> = {
  lang: { type: 'string', validate: validateLang },
  null: { type: 'string' },
  textDirection: {
    type: 'string',
    validate: (val) => ['ltr', 'rtl', 'auto', 'inherit'].includes(val),
  },
  separator: { type: 'string' },
  ordered: { type: 'boolean' },
  default: { type: 'string' },
  required: { type: 'boolean' },
};
export const inhPropKeys = [
  'aboutUrl',
  'datatype',
  'default',
  'lang',
  'null',
  'ordered',
  'propertyUrl',
  'required',
  'separator',
  'textDirection',
  'valueUrl',
];

export function validateInheritedProperties(
  props: CsvwInheritedProperties,
  message: string,
  ctx: ValidationContext
) {
  validateObject(props, inheritedPropertiesSchema, message, ctx);
  for (const prop of ['valueUrl', 'propertyUrl', 'aboutUrl'] as const) {
    if (props[prop] !== undefined && typeof props[prop] !== 'string') {
      ctx.issueTracker.addWarning(
        `${message}: Invalid value for ${prop}: expected a string.`
      );
      props[prop] = '';
    }
  }
  validateDatatype(props, ctx);
}
