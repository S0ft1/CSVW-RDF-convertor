import { pairwise } from './pairwise.js';

describe('pairwise', () => {
  it('should return pairs of elements from an even-length array', () => {
    const input = [1, 2, 3, 4];
    const expectedOutput: [number, number][] = [
      [1, 2],
      [3, 4],
    ];
    expect(pairwise(input)).toEqual(expectedOutput);
  });

  it('should throw an error if the array length is odd', () => {
    const input = [1, 2, 3];
    expect(() => pairwise(input)).toThrow('Array length must be even');
  });

  it('should return an empty array if the input array is empty', () => {
    const input: number[] = [];
    const expectedOutput: [number, number][] = [];
    expect(pairwise(input)).toEqual(expectedOutput);
  });
});
