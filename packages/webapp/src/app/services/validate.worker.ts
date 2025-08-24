/// <reference lib="webworker" />
import {
  Csvw2RdfOptions,
  defaultResolveStreamFn,
  defaultResolveJsonldFn,
  defaultResolveTextFn,
  validateCsvwFromDescriptor,
  validateCsvwFromUrl,
  Issue,
} from '@csvw-rdf-convertor/core';
import {
  InitValidationParams,
  EndMessage,
  ErrorMessage,
} from './validate.service';

addEventListener(
  'message',
  async ({ data }: { data: InitValidationParams }) => {
    let stream: AsyncIterable<Issue>;
    const options = getOptions(data);
    if (data.files.mainFileUrl) {
      if (data.files.mainFileUrl.match(/\.csv([?#].*)?$/)) {
        stream = validateCsvwFromUrl(data.files.mainFileUrl, options);
      } else {
        const file = await fetch(data.files.mainFileUrl).then((res) =>
          res.json(),
        );
        stream = validateCsvwFromDescriptor(file, {
          ...options,
          originalUrl: data.files.mainFileUrl,
        });
      }
    } else {
      if (data.files.mainFile.name.endsWith('.csv')) {
        stream = validateCsvwFromUrl(data.files.mainFile.name, options);
      } else {
        const file = await data.files.mainFile
          .text()
          .then((text) => JSON.parse(text));
        stream = validateCsvwFromDescriptor(file, options);
      }
    }

    for await (const issue of stream) {
      postMessage({ type: issue.type, data: issue } satisfies ErrorMessage);
    }

    postMessage({
      type: 'end',
    } satisfies EndMessage);
  },
);

function getOptions(params: InitValidationParams): Csvw2RdfOptions {
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
    minimal: true,
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
