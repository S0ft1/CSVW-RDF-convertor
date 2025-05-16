/**
 * This function takes an object and converts its properties with dot notation into nested objects.
 */
export function dotProps(object: Record<string, unknown>): void {
  for (const key in object) {
    const parts = key.split('.');
    if (parts.length > 1) {
      let curr = object;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in curr)) {
          curr[parts[i]] = {};
        }
        curr = curr[parts[i]] as Record<string, unknown>;
      }
      curr[parts[parts.length - 1]] = object[key];
      delete object[key];
    }
  }
}
