import { csvwNs } from './namespace.js';

export type IsExactlyUnknown<T> = unknown extends T
  ? [T] extends [unknown]
    ? true
    : false
  : false;

export type AnyOf<T, Keys extends keyof T = keyof T> = Omit<T, Keys> &
  {
    [k in Keys]: Pick<T, Exclude<Keys, k>> & Required<Pick<T, k>>;
  }[Keys];

type Primitive = string | number | null | undefined | boolean | bigint | symbol;
type IsPrimitiveOrUnknown<T> = T extends Primitive ? true : IsExactlyUnknown<T>;

type Expanded1Lvl<T, NS extends string> = IsPrimitiveOrUnknown<T> extends true
  ? T
  : {
      [k in keyof T as IsExactlyUnknown<T[k]> extends true
        ? k
        : k extends string
        ? k extends `@${string}`
          ? k
          : `${NS}#${k}`
        : k]: T[k];
    };

export type WithAdditionalProps<T> = T extends [infer U]
  ? [WithAdditionalProps<U>]
  : T extends [infer U, infer T]
  ? [WithAdditionalProps<U>, WithAdditionalProps<T>]
  : T extends (infer U)[]
  ? WithAdditionalProps<U>[]
  : IsPrimitiveOrUnknown<T> extends true
  ? T
  : {
      [k in keyof T]: WithAdditionalProps<T[k]>;
    } & {
      [k in Exclude<string, keyof T>]: unknown;
    };

export type MaybeExpanded<T, NS extends string = typeof csvwNs> = T extends [infer U]
  ? [MaybeExpanded<U, NS>]
  : T extends [infer U, infer T]
  ? [MaybeExpanded<U, NS>, MaybeExpanded<T, NS>]
  : T extends (infer U)[]
  ? MaybeExpanded<U, NS>[]
  : IsPrimitiveOrUnknown<T> extends true
  ? T
  :
      | {
          [k in keyof T]: MaybeExpanded<T[k], NS>;
        }
      | {
          [k in keyof Expanded1Lvl<T, NS>]: MaybeExpanded<Expanded1Lvl<T, NS>[k], NS>;
        };

export type Expanded<T, NS extends string = typeof csvwNs> = T extends [infer U]
  ? [Expanded<U, NS>]
  : T extends [infer U, infer T]
  ? [Expanded<U, NS>, Expanded<T, NS>]
  : T extends (infer U)[]
  ? Expanded<U, NS>[]
  : IsPrimitiveOrUnknown<T> extends true
  ? T
  : {
      [k in keyof Expanded1Lvl<T, NS>]: Expanded<Expanded1Lvl<T, NS>[k], NS>;
    };
