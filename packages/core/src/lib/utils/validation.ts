export function validateIdAndType(
  object: { '@id'?: string; '@type'?: string },
  expectedType: string
) {
  if (object['@id']?.startsWith('_:')) {
    throw new Error(expectedType + ' cannot have a blank node as id');
  }
  if (object['@type'] && object['@type'] !== expectedType) {
    throw new Error(expectedType + ' must have type TableGroup');
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
  cb: (val: Exclude<ArrayKeys<Obj>[Key], undefined>) => void
) {
  if (object[key] === undefined || object[key] === null) return;
  if (!Array.isArray(object[key])) {
    object[key] = [object[key]] as any;
  }
  object[key] = (object[key] as any[]).filter(
    (val) => val && typeof val === 'object'
  ) as any;
  (object[key] as any[]).forEach(cb);
}
