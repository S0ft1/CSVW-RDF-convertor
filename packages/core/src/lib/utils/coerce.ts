
/**
 * Converts the input into an array. If the input is already an array, it is returned as-is.
 * If the input is a single value, it is wrapped in an array. If the input is `undefined`,
 * an empty array is returned.
 *
 * @typeParam T - The type of the elements in the array.
 * @param {T} input  - The value to coerce into an array. It can be a single value, an array of values, or `undefined`.
 * @returns An array of non-nullable elements of type `T`.
 */
export function coerceArray<T extends {}>(
  input: T | T[] | undefined
): NonNullable<T>[] {
  if (input === undefined) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}
