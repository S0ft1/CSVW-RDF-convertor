import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import { coerceArray } from '../utils/coerce.js';
import { validate as bcp47Validate } from 'bcp47-validate';
/**
 * Validates the type of an object against an expected type.
 *
 * @param object - The object to validate, containing `@id` and `@type` properties.
 * @param expectedType - The expected type to validate against.
 * @param context - The context containing an issue tracker to log validation errors.
 */
export function validateType(
  object: { '@id'?: string; '@type'?: string },
  expectedType: string,
  { issueTracker }: Csvw2RdfContext
) {
  if (object['@type'] && object['@type'] !== expectedType) {
    issueTracker.addError(expectedType + ' must have type ' + expectedType);
  }
}

type ArrayKeys<Obj> = {
  [Key in keyof Obj as Required<Obj>[Key] extends any[]
    ? Key
    : never]: Required<Obj>[Key] extends (infer Val)[] ? Val : never;
};
/**
 * Validates an array property of an object, ensuring all elements meet a specified condition.
 *
 * @typeParam Obj - The type of the object containing the array property.
 * @typeParam Key - The key of the array property to validate.
 * @param object - The object containing the array property.
 * @param key - The key of the array property to validate.
 * @param cb - A callback function to validate each element of the array.
 * @param ctx - The context containing an issue tracker to log validation warnings.
 */
export function validateArray<Obj, Key extends keyof ArrayKeys<Obj>>(
  object: Obj,
  key: Key,
  cb: (
    val: Exclude<ArrayKeys<Obj>[Key], undefined>,
    ctx: Csvw2RdfContext
  ) => void,
  ctx: Csvw2RdfContext
) {
  if (object[key] === undefined || object[key] === null) return;
  object[key] = coerceArray(object[key]) as any;
  object[key] = (object[key] as any[]).filter((val, i) => {
    if (val && typeof val === 'object') return true;
    ctx.issueTracker.addWarning(
      `Invalid value for ${
        key as string
      }[${i}]: expected an object, got ${JSON.stringify(val)}.`
    );
    return false;
  }) as any;
  (object[key] as any[]).forEach((x) => cb(x, ctx));
}

export interface PropertySchema {
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-function-type */
  type: string | Function | (string | Function)[];
  required?: boolean;
  default?: any;
  validate?: (value: any) => boolean;
}

/** 
 * Validates the `@type` property of an object against an expected type.
 *
 * @param object - The object to validate, which may contain `@id` and `@type` properties.
 * @param expectedType - The expected type that the `@type` property should match.
 * @param context - The context object containing an issue tracker to log validation errors.
 *
 * @remarks
 * If the `@type` property exists and does not match the `expectedType`, an error is logged
 * to the issue tracker.
 */
export function validateObject<T extends object>(
  obj: T,
  defaults: { [key in keyof T]?: PropertySchema },
  message: string,
  { issueTracker }: Csvw2RdfContext
) {
  for (const [key, schema] of Object.entries(defaults) as Iterable<
    [keyof T, PropertySchema]
  >) {
    const type = coerceArray(schema.type);
    const val = obj[key];
    if (val === undefined) {
      if (schema.required && schema.default === undefined) {
        issueTracker.addError(
          `${message}: Missing required property ${key as string}`
        );
      } else if (schema.default !== undefined) {
        obj[key] = schema.default;
      }
      continue;
    }
    if (
      !type.some((t) =>
        typeof t === 'string' ? typeof val === t : val instanceof t
      )
    ) {
      if (schema.default !== undefined) {
        obj[key] = schema.default;
        issueTracker.addWarning(
          `${message}: Property ${
            key as string
          } is of type ${typeof val}, using default value ${JSON.stringify(
            schema.default
          )}`
        );
      } else if (schema.required) {
        issueTracker.addError(
          `${message}: Property ${
            key as string
          } is of type ${typeof val}, expected ${type.join(' or ')}`
        );
      } else {
        issueTracker.addWarning(
          `${message}: Property ${
            key as string
          } is of type ${typeof val}, expected ${type.join(' or ')}`
        );
        delete obj[key];
      }
      continue;
    }
    if (schema.validate && !schema.validate(val)) {
      if (schema.default !== undefined) {
        obj[key] = schema.default;
        issueTracker.addWarning(
          `${message}: Property ${
            key as string
          } is invalid, using default value ${JSON.stringify(schema.default)}`
        );
      } else if (schema.required) {
        issueTracker.addError(
          `${message}: Property ${key as string} is invalid: ${JSON.stringify(
            val
          )}`
        );
      } else {
        issueTracker.addWarning(
          `${message}: Property ${key as string} is invalid: ${JSON.stringify(
            val
          )}`
        );
        delete obj[key];
      }
    }
  }
}
/**
 * Validates a language tag, ensuring it is either `@none` or a valid BCP 47 language tag.
 *
 * @param lang - The language tag to validate.
 * @returns `true` if the language tag is valid, otherwise `false`.
 */
export function validateLang(lang: string) {
  return typeof lang === 'string' && (lang === '@none' || bcp47Validate(lang));
}

export const langMapArraySchema: PropertySchema = {
  type: ['string', Array, 'object'],
  validate: (val) => {
    if (typeof val === 'string') return true;
    if (Array.isArray(val)) return val.every((v) => typeof v === 'string');
    if (val === null) return false;
    return Object.entries(val).every(
      ([k, v]) =>
        validateLang(k) &&
        (typeof v === 'string' ||
          (Array.isArray(v) && v.every((vv) => typeof vv === 'string')))
    );
  },
};
/**
 * Validates that an object contains only allowed keys.
 *
 * @param obj - The object to validate.
 * @param allowedKeys - An array of allowed keys.
 * @param message - A message prefix for logging validation warnings.
 * @param context - The context containing an issue tracker to log validation warnings.
 */
export function validateAllowedKeys(
  obj: object,
  allowedKeys: string[],
  message: string,
  { issueTracker }: Csvw2RdfContext
) {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      issueTracker.addWarning(`${message}: Invalid property ${key}`);
    }
  }
}
/**
 * Validates a child object property, ensuring it is an object and applying a callback for further validation.
 *
 * @typeParam T - The type of the parent object.
 * @typeParam K - The key of the child object property to validate.
 * @param obj - The parent object containing the child property.
 * @param key - The key of the child property to validate.
 * @param cb - A callback function to validate the child object.
 * @param ctx - The context containing an issue tracker to log validation warnings.
 */
export function validateChild<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  cb: (val: Required<T>[K], ctx: Csvw2RdfContext) => void,
  ctx: Csvw2RdfContext
) {
  if (obj[key] === undefined) return;
  if (!obj[key] || typeof obj[key] !== 'object') {
    ctx.issueTracker.addWarning(
      `Invalid value for ${key as string}: expected an object, got ${typeof obj[
        key
      ]}.`
    );
    obj[key] = {} as any;
    return;
  }
  cb(obj[key], ctx);
}
