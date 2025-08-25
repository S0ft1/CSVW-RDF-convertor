/// <reference lib="webworker" />
import {
  csvwDescriptorToRdf,
  csvUrlToRdf,
  Csvw2RdfOptions,
  defaultResolveStreamFn,
  defaultResolveJsonldFn,
  defaultResolveTextFn,
  rdfStreamToArray,
  serializeRdf,
} from '@csvw-rdf-convertor/core';
import { ErrorMessage, InitC2RParams } from './c2r.service';
import { Quad, Stream } from '@rdfjs/types';

addEventListener('message', async ({ data }: { data: InitC2RParams }) => {
  let stream: Stream<Quad>;
  const options = getOptions(data);
  if (data.files.mainFileUrl) {
    if (data.files.mainFileUrl.match(/\.csv([?#].*)?$/)) {
      stream = csvUrlToRdf(data.files.mainFileUrl, options);
    } else {
      const file = await fetch(data.files.mainFileUrl).then((res) =>
        res.json(),
      );
      stream = csvwDescriptorToRdf(file, {
        ...options,
        originalUrl: data.files.mainFileUrl,
      });
    }
  } else {
    if (data.files.mainFile.name.endsWith('.csv')) {
      stream = csvUrlToRdf(data.files.mainFile.name, options);
    } else {
      const file = await data.files.mainFile
        .text()
        .then((text) => JSON.parse(text));
      stream = csvwDescriptorToRdf(file, options);
    }
  }

  stream.addListener('error', (error) => {
    postMessage({
      type: 'error',
      data:
        error?.type === 'error'
          ? error
          : { type: 'error', message: error?.message },
    } satisfies ErrorMessage);
  });
  stream.addListener('warning', (warning) => {
    postMessage({ type: 'warning', data: warning } satisfies ErrorMessage);
  });

  const outStream = await serializeRdf(stream, {
    format: data.format.format,
    turtle: {
      prefix: data.format.ttl.prefixes,
      base: data.format.ttl.baseIri,
      prefixLookup: data.format.ttl.lookupPrefixes,
      streaming: false,
    },
  });
  const chunks = await rdfStreamToArray(outStream);
  postMessage({ type: 'result', data: chunks.join('') });
});

function getOptions(params: InitC2RParams): Csvw2RdfOptions {
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href;
  const baseIri =
    params.options.baseIri || params.files.mainFileUrl || location.href;
  const otherFiles: Record<string, File> = {};
  if (params.files.mainFile) {
    const name = getUrl(params.files.mainFile.name, baseIri);
    otherFiles[name] = params.files.mainFile;
  }
  for (const file of params.files.otherFiles) {
    const name = getUrl(file.name, baseIri);
    otherFiles[name] = file;
  }

  const getUploadedFile = (url: string) => {
    return otherFiles[url];
  };
  return {
    ...params.options,
    baseIri,
    resolveCsvStreamFn: async (url, base) => {
      url = getUrl(url, base);
      const file = getUploadedFile(url);
      if (file) return file.stream().pipeThrough(new TextDecoderStream());
      return defaultResolveStreamFn(url, base);
    },
    resolveJsonldFn: (url, base) => {
      url = getUrl(url, base);
      const file = getUploadedFile(url);
      if (file) return file.text();
      return defaultResolveJsonldFn(url, base);
    },
    resolveWkfFn: async (url, base) => {
      url = getUrl(url, base);
      const file = getUploadedFile(url);
      if (file) return file.text();
      return defaultResolveTextFn(url, base);
    },
  };
}
