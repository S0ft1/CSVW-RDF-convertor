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
    console.log('replacing', longestMatch, 'with', replacement);
    console.log('url', url, '->', replacement + url.slice(longestMatch.length));
    return replacement + url.slice(longestMatch.length);
  }
  console.log('no replacement for', url);
  return url;
}
