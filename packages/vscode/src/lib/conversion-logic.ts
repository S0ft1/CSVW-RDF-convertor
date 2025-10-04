import * as vscode from 'vscode';
import {
  CompactedCsvwDescriptor,
  csvwDescriptorToRdf,
  CsvwRow,
  CsvwTable,
  parseRdf,
  Rdf2CsvOptions,
  rdfToCsvw,
  serializeRdf,
} from '@csvw-rdf-convertor/core';
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core';
import { ConversionItem, MiniOptions } from './types.js';
import { resolve } from 'node:path';
import * as csv from 'csv';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import * as path from 'path';
import { Quad, Stream } from '@rdfjs/types';
import { resolveJson, resolveText, resolveTextStream } from './resolvers.js';
import { RDFSerialization } from '@csvw-rdf-convertor/core';

/**
 * Gets the appropriate file extension for a conversion's output file based on saved RDF serialization preference.
 * @param conversion - The conversion item which may have a saved RDF serialization format
 * @returns The appropriate file extension, defaulting to '.ttl' if no preference is saved
 */
export function getOutputFileExtension(conversion: ConversionItem): string {
  if (conversion.rdfSerialization) {
    return getRdfFileExtension(conversion.rdfSerialization);
  }
  return '.ttl'; // Default to turtle format
}

/**
 * Maps RDF serialization formats to their corresponding file extensions.
 * @param format - The RDF serialization format
 * @returns The appropriate file extension for the format
 */
function getRdfFileExtension(format: RDFSerialization): string {
  const extensionMap: Record<RDFSerialization, string> = {
    'turtle': '.ttl',
    'ntriples': '.nt', 
    'nquads': '.nq',
    'trig': '.trig',
    'jsonld': '.jsonld',
    'rdfxml': '.rdf'
  };
  
  return extensionMap[format] || '.ttl';
}

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
  const stream = rdfToCsvw(rdfStream, options);

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
    const fileExtension = getRdfFileExtension(options.format);
    const outputFilePath = resolve(outputsDir, `output${fileExtension}`);
    conversion.outputFilePath = outputFilePath;
    if (conversion.descriptorFilePath && conversion.outputFilePath) {
      const rdfStream: Stream<Quad> = csvwDescriptorToRdf(
        descriptorText,
        csvw2RdfOptions,
      );
      const result = await serializeRdf(rdfStream, {
        format: options.format,
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

    csvMetadataFile = files.find(([name]) => name === 'csv-metadata.json');
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
  return {
    templateIris: optionsFromVS.templateIris,
    minimal: optionsFromVS.minimal,
    baseIri: inputsDirPath,
    resolveJsonldFn: resolveJson,
    resolveWkfFn: resolveText,
    resolveCsvStreamFn: resolveTextStream,
  };
}
function getRDFOptions(
  inputsDirPath: string,
  descriptorText: string,
): Rdf2CsvOptions {
  return {
    baseIri: inputsDirPath,
    descriptor: descriptorText,
    resolveJsonldFn: resolveJson,
  };
}

async function createRDFStreamInput(
  inputPath: string,
  inputsDir: string,
): Promise<Stream<Quad>> {
  return await parseRdf(inputPath, {
    baseIri: inputsDir,
    resolveStreamFn: resolveTextStream,
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
