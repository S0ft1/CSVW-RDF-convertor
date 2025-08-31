/// <reference lib="webworker" />
import {
  Rdf2CsvOptions,
  defaultResolveJsonldFn,
  rdfToTableSchema,
  parseRdf,
  defaultResolveStreamFn,
  rdfToCsvw,
  CsvwResultItem,
  CompactedCsvwDescriptor,
  CsvwTableGroupDescription,
} from '@csvw-rdf-convertor/core';
import {
  InitR2CParams,
  ResultFile,
  ResultMessage,
  SchemaMessage,
  WorkerRequest,
} from './r2c.service';
import { Quad, Stream } from '@rdfjs/types';
import { stringify } from 'csv-stringify/browser/esm/sync';
import { Options } from 'csv-stringify';

addEventListener('message', async ({ data }: { data: WorkerRequest }) => {
  const options = getOptions(data.params);
  const stream = await createRdfStream(data.params, options);

  if (data.type === 'schema') {
    const schema = await rdfToTableSchema(stream, options);
    postMessage({ type: 'schema', data: schema } satisfies SchemaMessage);
    return;
  } else if (data.type === 'convert') {
    const result = rdfToCsvw(stream, options);
    postMessage({
      type: 'result',
      data: await handleCsvwStream(result),
    } satisfies ResultMessage);
    return;
  }
});

async function handleCsvwStream(
  stream: AsyncIterable<CsvwResultItem>,
): Promise<ResultFile[]> {
  let latestDescriptor: CompactedCsvwDescriptor;
  const tables: Record<string, string> = {};
  const tableOptions: Record<string, Options> = {};
  for await (const { table, row, descriptor } of stream) {
    latestDescriptor = descriptor;
    if (!tables[table.name]) {
      const [hasHeader, options] = getDialect(descriptor, table.name);
      tables[table.name] ??= hasHeader
        ? stringify([table.columns], options)
        : '';
      tableOptions[table.name] = options;
    }
    tables[table.name] += stringify(
      [table.columns.map((col) => row[col])],
      tableOptions[table.name],
    );
  }
  const result: ResultFile[] = [
    {
      filename: latestDescriptor['@id'] ?? 'descriptor.json',
      content: JSON.stringify(latestDescriptor, null, 2),
    },
  ];
  for (const [filename, content] of Object.entries(tables)) {
    result.push({
      filename,
      content,
    });
  }
  return result;
}

function getDialect(
  descriptor: CompactedCsvwDescriptor,
  table: string,
): [boolean, Options] {
  const dialect = descriptor.dialect ?? {};
  const tableDialect =
    (descriptor as CsvwTableGroupDescription).tables.find(
      (t) => t.url === table,
    ).dialect ?? {};

  const hasHeader = tableDialect.header ?? dialect.header ?? true;
  const toArr = (val: any) => (Array.isArray(val) ? val : [val]);

  return [
    hasHeader,
    {
      delimiter: dialect.delimiter ?? ',',
      escape: (dialect.doubleQuote ?? true) ? '"' : '\\',
      record_delimiter: dialect.lineTerminators
        ? toArr(dialect.lineTerminators)[0]
        : '\n',
      quote: dialect.quoteChar ?? '"',
    },
  ];
}

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
    descriptor: params.descriptor,
    baseIri,
    resolveJsonldFn: (url, base) => {
      url = getUrl(url, base);
      const file = getUploadedFile(url);
      if (file) return file.text();
      return defaultResolveJsonldFn(url, base);
    },
    resolveRdfFn: async (url, base) => {
      url = getUrl(url, base);
      const file = getUploadedFile(url);
      if (file) return file.stream().pipeThrough(new TextDecoderStream());
      return defaultResolveStreamFn(url, base);
    },
  };
}

async function createRdfStream(
  params: InitR2CParams,
  options: Rdf2CsvOptions,
): Promise<Stream<Quad>> {
  if (params.files.mainFileUrl) {
    return parseRdf(params.files.mainFileUrl, {
      baseIri: options.baseIri,
      resolveStreamFn: options.resolveRdfFn,
    });
  } else {
    return parseRdf(params.files.mainFile.name, {
      baseIri: options.baseIri,
      resolveStreamFn: options.resolveRdfFn,
    });
  }
}
