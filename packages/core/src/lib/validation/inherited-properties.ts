
import { CsvwInheritedProperties } from '../types/descriptor/inherited-properties.js';
import { validateDatatype } from './datatype.js';
import { PropertySchema, validateLang, validateObject } from './generic.js';
import { Csvw2RdfContext } from '../csvw2rdf/context.js';

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

/**
 * Validates the inherited properties of a CSVW descriptor object.
 *
 * This function checks the structure and values of the provided `props` object
 * against the predefined schema for inherited properties. It ensures that the
 * properties conform to the expected types and constraints. Additionally, it
 * validates specific properties (`valueUrl`, `propertyUrl`, `aboutUrl`) to ensure
 * they are strings, issuing warnings and resetting invalid values if necessary.
 * The `datatype` property is also validated using a dedicated function.
 *
 * @param props - The inherited properties object to validate.
 * @param message - A descriptive message used for logging validation issues.
 * @param ctx - The context object containing the issue tracker and other utilities.
 */
export function validateInheritedProperties(
  props: CsvwInheritedProperties,
  message: string,
  ctx: Csvw2RdfContext
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
