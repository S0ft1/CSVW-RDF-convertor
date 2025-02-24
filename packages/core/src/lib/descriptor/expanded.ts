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

type Expanded1Lvl<T> = IsPrimitiveOrUnknown<T> extends true
  ? T
  : {
      [k in keyof T as IsExactlyUnknown<T[k]> extends true
        ? k
        : k extends string
        ? k extends `@${string}`
          ? k
          : `${typeof csvwNs}#${k}`
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

export type MaybeExpanded<T> = T extends [infer U]
  ? [MaybeExpanded<U>]
  : T extends [infer U, infer T]
  ? [MaybeExpanded<U>, MaybeExpanded<T>]
  : T extends (infer U)[]
  ? MaybeExpanded<U>[]
  : IsPrimitiveOrUnknown<T> extends true
  ? T
  :
      | {
          [k in keyof T]: MaybeExpanded<T[k]>;
        }
      | {
          [k in keyof Expanded1Lvl<T>]: MaybeExpanded<Expanded1Lvl<T>[k]>;
        };

export type Expanded<T> = T extends [infer U]
  ? [Expanded<U>]
  : T extends [infer U, infer T]
  ? [Expanded<U>, Expanded<T>]
  : T extends (infer U)[]
  ? Expanded<U>[]
  : IsPrimitiveOrUnknown<T> extends true
  ? T
  : {
      [k in keyof Expanded1Lvl<T>]: Expanded<Expanded1Lvl<T>[k]>;
    };
