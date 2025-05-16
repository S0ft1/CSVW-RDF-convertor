/**
 * Find all URIs in a descriptor object.
 * @param descriptor any object which may contain URIs
 * @param bag container for found URIs
 */
export function allUris(
  descriptor: unknown,
  bag = new Set<string>()
): Set<string> {
  if (typeof descriptor === 'string') {
    if (URL.canParse(descriptor)) {
      bag.add(descriptor);
    }
  } else if (Array.isArray(descriptor)) {
    for (const item of descriptor) {
      allUris(item, bag);
    }
  } else if (typeof descriptor === 'object' && descriptor !== null) {
    for (const value of Object.values(descriptor)) {
      allUris(value, bag);
    }
  }
  return bag;
}
