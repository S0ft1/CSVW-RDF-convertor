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
