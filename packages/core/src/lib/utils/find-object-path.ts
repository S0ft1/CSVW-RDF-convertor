export function findObjectPath(
  obj: any,
  endKey: string | symbol | number,
):
  | {
      path: (string | symbol | number)[];
      values: any[];
    }
  | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  if (endKey in obj) {
    return {
      path: [endKey],
      values: [obj, obj[endKey]],
    };
  }

  const path: (string | symbol | number)[] = [];
  const values: any[] = [obj];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = findObjectPath(obj[i], endKey);
      if (result) {
        path.push(i, ...result.path);
        values.push(...result.values);
        return { path, values };
      }
    }
    return undefined;
  }
  for (const key in obj) {
    const result = findObjectPath(obj[key], endKey);
    if (result) {
      path.push(key, ...result.path);
      values.push(...result.values);
      return { path, values };
    }
  }

  return undefined;
}
