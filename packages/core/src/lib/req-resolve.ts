export type ResolveFn = (url: string) => Promise<string>;
export type ResolveStreamFn = (url: string) => Promise<ReadableStream<string>>;

export function defaultResolveFn(url: string): Promise<string> {
  return fetch(url).then((res) => res.text());
}
export function defaultResolveStreamFn(
  url: string
): Promise<ReadableStream<string>> {
  return fetch(url).then((res) => res.body ?? new ReadableStream());
}
