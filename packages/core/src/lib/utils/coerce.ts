export function coerceArray<T extends {}>(
  input: T | T[] | undefined
): NonNullable<T>[] {
  if (input === undefined) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}
