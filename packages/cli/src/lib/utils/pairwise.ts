export function pairwise<T>(arr: T[]): [T, T][] {
  if (arr.length % 2) {
    throw new Error('Array length must be even');
  }
  const result: [T, T][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    result.push([arr[i], arr[i + 1]]);
  }
  return result;
}
