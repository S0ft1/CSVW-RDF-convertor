import { Csvw2RdfContext } from '../csvw2rdf/context.js';
import { coerceArray } from '../utils/coerce.js';
import { validate as bcp47Validate } from 'bcp47-validate';

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
