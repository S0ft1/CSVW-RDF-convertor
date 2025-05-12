/**
 * Replaces the beginning of a given URL with a corresponding replacement string
 * based on a set of path overrides. The function matches the longest prefix
 * or regular expression match from the provided overrides.
 *
 * @param url - The URL to be processed and potentially replaced.
 * @param pathOverrides - An array of tuples where each tuple contains:
 *   - `from`: A string or regular expression to match against the start of the URL.
 *   - `to`: A string to replace the matched portion of the URL.
 * 
 * @returns The modified URL if a match is found, or the original URL if no match is found.
 */
export function replaceUrl(
  url: string,
  pathOverrides: [string | RegExp, string][]
): string {
  let longestMatch = '';
  let replacement = '';
  for (const [from, to] of pathOverrides) {
    if (from instanceof RegExp) {
      const match = from.exec(url);
      if (match && match.index === 0 && match[0].length > longestMatch.length) {
        longestMatch = match[0];
        replacement = to;
      }
    } else if (url.startsWith(from) && from.length > longestMatch.length) {
      longestMatch = from;
      replacement = to;
    }
  }
  if (longestMatch) {
    return replacement + url.slice(longestMatch.length);
  }
  return url;
}
