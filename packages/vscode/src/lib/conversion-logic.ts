import * as vscode from 'vscode';
import {
  CompactedCsvwDescriptor,
  csvwDescriptorToRdf,
  CsvwRow,
  CsvwTable,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
  parseRdf,
  Rdf2CsvOptions,
  rdfToCsvw,
  serializeRdf,
} from '@csvw-rdf-convertor/core';
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core';
import { ConversionItem, MiniOptions } from './types.js';
import { isAbsolute, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as csv from 'csv';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import * as path from 'path';
import { Quad, Stream } from '@rdfjs/types';
/**
 * Converts RDF data to CSVW format using CSVW metadata.
 * @param descriptorText - The CSVW metadata descriptor content.
 * @param inputPath - Path to the RDF data file.
 * @param descriptorPath - Path to the descriptor file.
 * @param conversion - The conversion object with additional options.
 * @returns Promise containing created table file names.
 */
export async function convertRDF2CSVW(
  descriptorText: string,
  inputPath: string,
  conversion: ConversionItem,
): Promise<string[]> {
  // Validate conversion object has required properties
  if (!conversion.folderPath) {
    throw new Error(
      'Conversion folderPath is undefined - conversion object not properly initialized',
    );
  }
  let hasDescriptor = true;
  if (descriptorText.trim().length === 0) {
    hasDescriptor = false;
  }
  const inputsDir = path.join(conversion.folderPath, 'inputs');
  const options: Rdf2CsvOptions = getRDFOptions(inputsDir, descriptorText);

  const rdfStream = await createRDFStreamInput(inputPath, inputsDir);
  const stream = await rdfToCsvw(rdfStream, options);

  let latestDescriptor: CompactedCsvwDescriptor | undefined;
  const stringifiers: { [table: string]: csv.stringifier.Stringifier } = {};
  let descriptor: CompactedCsvwDescriptor | undefined;
  let table: CsvwTable;
  let row: CsvwRow;
  const tableNames = [];

  for await ({ descriptor, table, row } of stream) {
    if (stringifiers[table.name] === undefined) {
      const outputsDir = path.join(conversion.folderPath, 'outputs');
      const tableFilePath = resolve(outputsDir, table.name);
      const outputStream = fs.createWriteStream(tableFilePath);
      tableNames.push(tableFilePath);
      const descriptorOptions = getAdditionalDescriptorOptions(
        descriptor,
        table,
      );
      stringifiers[table.name] = csv.stringify(descriptorOptions);
      stringifiers[table.name].pipe(outputStream);
    }
    stringifiers[table.name].write(row);
    latestDescriptor = descriptor;
  }
  if (latestDescriptor && !hasDescriptor) {
    const descriptorText = JSON.stringify(latestDescriptor, null, '  ');

    if (conversion.descriptorFilePath) {
      try {
        const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);
        const descriptorDocument =
          await vscode.workspace.openTextDocument(descriptorUri);
        // Edit the document to make it dirty, then save it to trigger the listener
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          descriptorUri,
          new vscode.Range(0, 0, descriptorDocument.lineCount, 0),
          descriptorText,
        );
        await vscode.workspace.applyEdit(edit);
        await descriptorDocument.save();
      } catch (error) {
        console.warn(`Failed to write descriptor file: ${error}`);
      }
    }
  }
  return Promise.resolve(tableNames);
}

/**
 * Converts CSV data to RDF format using CSVW metadata and specified options.
 * @param descriptorText - The CSVW metadata descriptor content.
 * @param options - Conversion options including template IRIs and minimal mode settings.
 * @param conversion - The conversion object containing file paths and additional context.
 * @returns Promise resolving to array containing the output file path.
 */
export async function convertCSVW2RDF(
  descriptorText: string,
  options: MiniOptions,
  conversion: ConversionItem,
): Promise<string[]> {
  const inputsDir = path.join(conversion.folderPath, 'inputs');
  const csvw2RdfOptions: Csvw2RdfOptions = getCSVWOptions(options, inputsDir);
  try {
    const outputsDir = path.join(conversion.folderPath, 'outputs');
    const outputTtlPath = resolve(outputsDir, 'output.ttl');
    conversion.outputFilePath = outputTtlPath;
    if (conversion.descriptorFilePath && conversion.outputFilePath) {
      const rdfStream: Stream<Quad> = csvwDescriptorToRdf(
        descriptorText,
        csvw2RdfOptions,
      );
      const result = await serializeRdf(rdfStream, {
        format: 'turtle',
        turtle: { streaming: false },
      });
      const typedResult = result as Readable;
      const outputText = await new Promise<string>((resolve, reject) => {
        let rdfData = '';

        typedResult.on('data', (chunk) => {
          rdfData += chunk.toString();
        });

        typedResult.on('end', () => {
          resolve(rdfData);
        });

        typedResult.on('error', (error) => {
          reject(error);
        });
      });

      await fs.promises.writeFile(
        conversion.outputFilePath,
        outputText,
        'utf-8',
      );
      return [conversion.outputFilePath];
    } else {
      throw new Error('Missing descriptor file path or output file path');
    }
  } catch (error) {
    throw new Error(
      `Error in CSV to RDF conversion: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export async function findMetadata(csvUrl: string): Promise<string | null> {
  const csvDir = path.dirname(csvUrl);
  try {
    const dirUri = vscode.Uri.file(csvDir);
    const files = await vscode.workspace.fs.readDirectory(dirUri);

    let csvMetadataFile = files.find(
      ([name]) => name === `${csvUrl}-metadata.json`,
    );
    if (csvMetadataFile) {
      return path.join(csvDir, csvMetadataFile[0]);
    }

    csvMetadataFile = files.find(
      ([name]) => name === 'csv-metadata.json',
    );
    if (csvMetadataFile) {
      return path.join(csvDir, csvMetadataFile[0]);
    }

    return null;
  } catch (error) {
    throw new Error(
      `Error finding metadata for ${csvUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export function getCSVWOptions(
  optionsFromVS: MiniOptions,
  inputsDirPath: string,
): Csvw2RdfOptions {
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  return {
    templateIris: optionsFromVS.templateIris,
    minimal: optionsFromVS.minimal,
    baseIri: inputsDirPath,
    resolveJsonldFn: async (path:string, base:string) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && URL.canParse(url)) {
        if (url.startsWith('file:')) {
          return readFile(fileURLToPath(url), 'utf-8');
        }
        return defaultResolveJsonldFn(url, base);
      }
      return await readFile(url, 'utf-8');
    },
    resolveWkfFn: async (path:string, base:string) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && URL.canParse(url)) {
        if (url.startsWith('file:')) {
          return readFile(fileURLToPath(url), 'utf-8');
        }
        return defaultResolveTextFn(url, base);
      }
      return await readFile(url, 'utf-8');
    },
    resolveCsvStreamFn: (path:string, base:string) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
        if (url.startsWith('file:')) {
          return Promise.resolve(
            Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8')),
          );
        }
        return defaultResolveStreamFn(url, base);
      }
      return Promise.resolve(
        Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8')),
      );
    },
  };
}
function getRDFOptions(
  inputsDirPath: string,
  descriptorText: string,
): Rdf2CsvOptions {
  return {
    baseIri: inputsDirPath,
    descriptor: descriptorText,
    resolveJsonldFn: async (path:string, base:string) => {
      const url =
        URL.parse(path, base)?.href ??
        URL.parse(path)?.href ??
        resolve(base, path);
      if (!isAbsolute(url) && URL.canParse(url)) {
        if (url.startsWith('file:')) {
          return readFile(fileURLToPath(url), 'utf-8');
        }
        return defaultResolveJsonldFn(url, base);
      }
      return await readFile(url, 'utf-8');
    },
  };
}

async function createRDFStreamInput(
  inputPath: string,
  inputsDir: string,
): Promise<Stream<Quad>> {
  return await parseRdf(inputPath, {
    baseIri: inputsDir,
    resolveStreamFn(path:string, base:string) {
      const url =
        URL.parse(path, base)?.href ??
        URL.parse(path)?.href ??
        resolve(base, path);
      if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
        if (url.startsWith('file:')) {
          return Promise.resolve(
            Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8')),
          );
        }
        return defaultResolveStreamFn(url, base);
      }
      return Promise.resolve(
        Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8')),
      );
    },
  });
}

function getAdditionalDescriptorOptions(
  descriptor: CompactedCsvwDescriptor,
  table: CsvwTable,
) {
  const dialect = descriptor.dialect ?? {};
  return {
    header: dialect.header ?? true,
    columns: table.columns,
    ...(dialect.delimiter !== undefined && {
      delimiter: dialect.delimiter,
    }),
    ...(dialect.doubleQuote !== undefined && {
      escape: dialect.doubleQuote ? '"' : '\\',
    }),
    ...(dialect.quoteChar !== undefined &&
      dialect.quoteChar !== null && { quote: dialect.quoteChar }),
  };
}
