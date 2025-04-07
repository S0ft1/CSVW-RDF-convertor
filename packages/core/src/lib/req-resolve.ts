export type ResolveJsonldFn = (url: string, base: string) => Promise<string>;
export type ResolveWkfFn = (url: string, base: string) => Promise<string>;
export type ResolveCsvStreamFn = (
  url: string,
  base: string
) => Promise<ReadableStream<string>>;

export async function getLinkedContext(resp: Response) {
  const linkHeader = resp.headers.get('link');
  const contentType = resp.headers.get('content-type');
  if (linkHeader && contentType !== 'application/ld+json') {
    // If there is more than one valid metadata file linked to through multiple Link headers, then implementations MUST use the metadata file referenced by the last Link header.
    const linkedContext = parseLinkHeader(linkHeader, resp.url);
    if (linkedContext) {
      return linkedContext[linkedContext.length - 1];
    }
  }
  return undefined;
}

const linkTypes = new Set([
  'application/csvm+json',
  'application/ld+json',
  'application/json',
]);
function parseLinkHeader(header: string, base: string): string[] {
  const res: string[] = [];
  const entries = header.split(',').map((x) => x.trim());
  for (const entry of entries) {
    const [url, ...rest] = entry.split(';').map((x) => x.trim());
    const urlTrimmed = url.slice(1, -1); // remove < and >
    const parsed = URL.parse(urlTrimmed) ?? URL.parse(urlTrimmed, base);
    if (!parsed) continue;
    const attributes = Object.fromEntries(
      rest.map((x) => {
        const [key, value] = x.split('=').map((x) => x.trim());
        return [key, value.slice(1, -1)]; // remove " and "
      })
    );
    if (
      attributes['rel'].toLowerCase() === 'describedby' &&
      linkTypes.has(attributes['type'].toLowerCase())
    ) {
      res.push(parsed.href);
    }
  }
  return res;
}

export async function defaultResolveJsonldFn(
  url: string,
  base: string
): Promise<string> {
  const resp = await fetch(toAbsolute(url, base), {
    headers: { Accept: 'application/ld+json' },
  });
  const linkedContext = await getLinkedContext(resp);
  if (linkedContext) {
    return defaultResolveJsonldFn(linkedContext, base);
  }
  if (!resp.ok) throw new Error('Failed to fetch: ' + url);
  const res = await resp.text();
  return res;
}
export async function defaultResolveStreamFn(
  url: string,
  base: string
): Promise<ReadableStream<string>> {
  const res = await fetch(toAbsolute(url, base));
  if (!res.ok) throw new Error('Failed to fetch: ' + url);
  const stream = res.body ?? new ReadableStream();
  return stream.pipeThrough(new TextDecoderStream());
}

export function toAbsolute(url: string, base: string) {
  const parsed = URL.parse(url) ?? URL.parse(url, base);
  if (!parsed) throw new Error('Invalid URL: ' + url);
  return parsed.href;
}

export async function defaultResolveTextFn(
  url: string,
  base: string
): Promise<string> {
  const resp = await fetch(toAbsolute(url, base));
  if (!resp.ok) throw new Error('Failed to fetch: ' + url);
  const res = await resp.text();
  return res;
}
