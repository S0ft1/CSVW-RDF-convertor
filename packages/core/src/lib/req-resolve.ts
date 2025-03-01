import { MultiMap } from 'mnemonist';

export type ResolveJsonldFn = (url: string, base: string) => Promise<string>;
export type ResolveCsvStreamFn = (
  url: string,
  base: string
) => Promise<ReadableStream<string>>;

async function getLinkedContext(resp: Response) {
  const linkHeader = resp.headers.get('link');
  const contentType = resp.headers.get('content-type');
  if (linkHeader && contentType !== 'application/ld+json') {
    // If there is more than one valid metadata file linked to through multiple Link headers, then implementations MUST use the metadata file referenced by the last Link header.
    const linkHeaders = parseLinkHeader(linkHeader, resp.url);
    const linkedContext = linkHeaders.get(
      'http://www.w3.org/ns/json-ld#context'
    );
    if (linkedContext) {
      return linkedContext[linkedContext.length - 1];
    }
  }
  return undefined;
}

function parseLinkHeader(
  header: string,
  base: string
): MultiMap<string, string> {
  console.log(header);
  const res = new MultiMap<string, string>();
  const entries = header.split(',').map((x) => x.trim());
  for (const entry of entries) {
    const [url, ...rest] = entry.split(';').map((x) => x.trim());
    const parsed = URL.parse(url) ?? URL.parse(url, base);
    if (!parsed) continue;
    for (const r of rest) {
      const [key, value] = r.split('=').map((x) => x.trim());
      if (key === 'rel') {
        res.set(value, parsed.href);
      }
    }
  }
  return res;
}

export async function defaultResolveFn(
  url: string,
  base: string
): Promise<string> {
  const resp = await fetch(toAbsolute(url, base), {
    headers: { Accept: 'application/ld+json' },
  });
  const linkedContext = await getLinkedContext(resp);
  if (linkedContext) {
    return defaultResolveFn(linkedContext, base);
  }
  const res = await resp.text();
  return res;
}
export async function defaultResolveStreamFn(
  url: string,
  base: string
): Promise<ReadableStream<string>> {
  const res = await fetch(toAbsolute(url, base));
  const stream = res.body ?? new ReadableStream();
  return stream.pipeThrough(new TextDecoderStream());
}

function toAbsolute(url: string, base: string) {
  const parsed = URL.parse(url) ?? URL.parse(url, base);
  if (!parsed) throw new Error('Invalid URL: ' + url);
  return parsed.href;
}
