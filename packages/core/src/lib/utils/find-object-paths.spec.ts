import { findObjectPath } from './find-object-path.js';

describe('findObjectPath', () => {
  it('should return the path to a nested value', () => {
    const obj = { a: { b: { c: 42 } } };
    const result = findObjectPath(obj, 'c');
    expect(result).toEqual({
      path: ['a', 'b', 'c'],
      values: [obj, obj.a, obj.a.b, 42],
    });
  });

  it('should return undefined if value is not found', () => {
    const obj = { a: { b: { c: 42 } } };
    const result = findObjectPath(obj, 'd');
    expect(result).toBeUndefined();
  });

  it('should find value at root level', () => {
    const obj = { a: 1, b: 2 };
    const result = findObjectPath(obj, 'b');
    expect(result).toEqual({ path: ['b'], values: [obj, 2] });
  });

  it('should find value in array', () => {
    const obj = { a: [1, 2, { b: 3 }] };
    const result = findObjectPath(obj, 'b');
    expect(result).toEqual({
      path: ['a', 2, 'b'],
      values: [obj, obj.a, obj.a[2], 3],
    });
  });

  it('should return the first path found if value appears multiple times', () => {
    const obj = { a: { d: 1 }, b: { d: 2 } };
    const result = findObjectPath(obj, 'd');
    // Should return path to the first occurrence
    expect(result).toEqual({ path: ['a', 'd'], values: [obj, obj.a, 1] });
  });

  it('should handle empty object', () => {
    const obj = {};
    const result = findObjectPath(obj, 1);
    expect(result).toBeUndefined();
  });
});
