/// <reference lib="webworker" />
import {
  csvwDescriptorToRdf,
  csvUrlToRdf,
  Rdf2CsvOptions,
  defaultResolveJsonldFn,
  rdfToTableSchema,
} from '@csvw-rdf-convertor/core';
import { InitR2CParams, WorkerRequest } from './r2c.service';
import { Quad, Stream } from '@rdfjs/types';

addEventListener('message', async ({ data }: { data: WorkerRequest }) => {
  const options = getOptions(data.params);
  const stream = await createRdfStream(data.params, options);

  if (data.type === 'schema') {
    const schema = await rdfToTableSchema(stream, options);
    postMessage({ type: 'schema', schema });
    return;
  }
});

function getOptions(params: InitR2CParams): Rdf2CsvOptions {
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
    resolveJsonldFn: (url, base) => {
      url = getUrl(url, base);
      const file = getUploadedFile(url);
      if (file) return file.text();
      return defaultResolveJsonldFn(url, base);
    },
  };
}

async function createRdfStream(
  params: InitR2CParams,
  options: Rdf2CsvOptions,
): Promise<Stream<Quad>> {
  let stream: Stream<Quad>;
  if (params.files.mainFileUrl) {
    if (params.files.mainFileUrl.match(/\.csv([?#].*)?$/)) {
      stream = csvUrlToRdf(params.files.mainFileUrl, options);
    } else {
      const file = await fetch(params.files.mainFileUrl).then((res) =>
        res.json(),
      );
      stream = csvwDescriptorToRdf(file, {
        ...options,
        originalUrl: params.files.mainFileUrl,
      });
    }
  } else {
    if (params.files.mainFile.name.endsWith('.csv')) {
      stream = csvUrlToRdf(params.files.mainFile.name, options);
    } else {
      const file = await params.files.mainFile
        .text()
        .then((text) => JSON.parse(text));
      stream = csvwDescriptorToRdf(file, options);
    }
  }
  return stream;
}
