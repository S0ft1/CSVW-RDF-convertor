/// <reference lib="webworker" />
import {
  csvwDescriptorToRdf,
  csvUrlToRdf,
  Csvw2RdfOptions,
  defaultResolveStreamFn,
  defaultResolveJsonldFn,
  defaultResolveTextFn,
  rdfStreamToArray,
  lookupPrefixes,
  n3Formats,
} from '@csvw-rdf-convertor/core';
import { DataMessage, ErrorMessage, InitC2RParams } from './c2r.service';
import { Quad, Stream } from '@rdfjs/types';
import TurtleSerializer from '@rdfjs/serializer-turtle';
import PrefixMap from '@rdfjs/prefix-map/PrefixMap.js';
import N3 from 'n3';

const { namedNode } = N3.DataFactory;

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
      console.log(`Converting CSV file: ${data.files.mainFile.name}`, options);
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

  if (data.format.format === 'turtle' || data.format.format === 'trig') {
    outputFormattedTurtle(stream, data);
  } else {
    outputN3(stream, data);
  }
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

function outputN3(stream: Stream<Quad>, params: InitC2RParams): void {
  const writer = new N3.StreamWriter({
    prefixes: params.format.ttl.prefixes,
    format: n3Formats[params.format.format],
  });
  writer.import(stream);
  // create a blob to send back
  const output: string[] = [];
  writer.on('data', (data) => output.push(data));
  writer.on('error', (error) => {
    throw error;
  });
  writer.on('end', () => {
    postMessage({
      type: 'result',
      data: output.join(''),
    } satisfies DataMessage);
  });
}

async function outputFormattedTurtle(
  stream: Stream<Quad>,
  params: InitC2RParams,
) {
  const quads = await rdfStreamToArray(stream);
  const prefixes = params.format.ttl.lookupPrefixes
    ? await lookupPrefixes(quads, params.format.ttl.prefixes)
    : new PrefixMap(
        Object.entries(params.format.ttl.prefixes).map(([k, v]) => [
          k,
          namedNode(v),
        ]),
        { factory: N3.DataFactory },
      );

  const writer = new TurtleSerializer({
    baseIRI: params.format.ttl.baseIri,
    prefixes,
  });
  const output = writer.transform(quads);
  postMessage({
    type: 'result',
    data: output,
  } satisfies DataMessage);
}
