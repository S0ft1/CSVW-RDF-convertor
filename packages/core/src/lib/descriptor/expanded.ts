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

export type WithPrefix<IRI extends string, T extends string> = `${IRI}${T}`;

export type Expanded<T> = {
  [k in keyof T as IsExactlyUnknown<T[k]> extends true
    ? k
    : k extends string
    ? WithPrefix<typeof csvwNs, k>
    : k]: T[k];
};
