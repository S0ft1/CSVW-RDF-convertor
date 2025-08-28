import * as vscode from 'vscode';
import {
	csvwDescriptorToRdf,
	CsvwRow,
	CsvwTable,
	defaultResolveJsonldFn,
	defaultResolveStreamFn,
	defaultResolveTextFn,
	DescriptorWrapper,
	parseRdf,
	Rdf2CsvOptions,
	rdfStreamToArray,
	rdfToCsvw,
	rdfToTableSchema,
	serializeRdf
} from '@csvw-rdf-convertor/core'
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core'
import { ConversionItem, MiniOptions, ConversionType } from './types.js';
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
export async function convertRDF2CSVW(descriptorText: string, inputPath: string, conversion: ConversionItem): Promise<string[]> {
	// Validate conversion object has required properties
	if (!conversion.folderPath) {
		throw new Error('Conversion folderPath is undefined - conversion object not properly initialized');
	}

	const inputsDir = path.join(conversion.folderPath, 'inputs');
	const options: Rdf2CsvOptions = {
		baseIri: inputsDir,
		descriptor: descriptorText,
		resolveJsonldFn: async (path, base) => {
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
		}
	};

	let rdfStream = await parseRdf(inputPath, {
		baseIri: inputsDir, resolveStreamFn(path, base) {
			const url =
				URL.parse(path, base)?.href ??
				URL.parse(path)?.href ??
				resolve(base, path);
			if (
				!isAbsolute(url) &&
				(URL.canParse(url) || URL.canParse(url, base))
			) {
				if (url.startsWith('file:')) {
					return Promise.resolve(
						Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8'))
					);
				}
				return defaultResolveStreamFn(url, base);
			}
			return Promise.resolve(
				Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8'))
			);
		},
	});

	const stream = await rdfToCsvw(rdfStream, options);
	//const schema = await rdfToTableSchema(rdfStream,options);

	const stringifiers: { [table: string]: csv.stringifier.Stringifier } = {};
	let descriptor: DescriptorWrapper;
	let table: CsvwTable;
	let row: CsvwRow;
	let tableNames = [];
	for await ([descriptor, table, row] of stream) {
		if (stringifiers[table.name] === undefined) {
			const outputsDir = path.join(conversion.folderPath, 'outputs');
			const tableFilePath = resolve(outputsDir, table.name);
			const outputStream = fs.createWriteStream(
				tableFilePath
			);
			tableNames.push(tableFilePath);
			const dialect = descriptor.descriptor.dialect ?? {};
			const descriptorOptions = {
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

			stringifiers[table.name] = csv.stringify(descriptorOptions);
			stringifiers[table.name].pipe(outputStream);
		}
		stringifiers[table.name].write(row);
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
export async function convertCSVW2RDF(descriptorText: string, options: MiniOptions, conversion: ConversionItem): Promise<string[]> {
	const inputsDir = path.join(conversion.folderPath, 'inputs');
	const getUrl = (path: string, base: string) =>
		URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
	const csvw2RdfOptions: Csvw2RdfOptions = {
		templateIris: options.templateIris,
		minimal: options.minimal,
		baseIri: inputsDir,
		resolveJsonldFn: async (path, base) => {
			const url = getUrl(path, base);
			if (!isAbsolute(url) && URL.canParse(url)) {
				if (url.startsWith('file:')) {
					return readFile(fileURLToPath(url), 'utf-8');
				}
				return defaultResolveJsonldFn(url, base);
			}
			return await readFile(url, 'utf-8');
		},
		resolveWkfFn: async (path, base) => {
			const url = getUrl(path, base);
			if (!isAbsolute(url) && URL.canParse(url)) {
				if (url.startsWith('file:')) {
					return readFile(fileURLToPath(url), 'utf-8');
				}
				return defaultResolveTextFn(url, base);
			}
			return await readFile(url, 'utf-8');
		},
		resolveCsvStreamFn: (path, base) => {
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

	try {

		const outputsDir = path.join(conversion.folderPath, 'outputs');
		const outputTtlPath = resolve(outputsDir, 'output.ttl');
		conversion.outputFilePath = outputTtlPath;
		if (conversion.descriptorFilePath && conversion.outputFilePath) {
			const rdfStream: Stream<Quad> = csvwDescriptorToRdf(descriptorText, csvw2RdfOptions);
			const result = await serializeRdf(rdfStream, { format: 'turtle', turtle: { streaming: false } })
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

			// Write the RDF data to the output.ttl file only
			await fs.promises.writeFile(conversion.outputFilePath, outputText, 'utf-8');
			return [conversion.outputFilePath];
		} else {
			throw new Error('Missing descriptor file path or output file path');
		}
	} catch (error) {
		throw new Error(`Error in CSV to RDF conversion: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}


/**
 * Analyzes input text content to determine if it's RDF or CSV format.
 * Simple format detection focused on distinguishing between RDF and CSV.
 * @param inputText - The text content to analyze.
 * @returns Object containing isRdf boolean and isRecognized boolean indicating detection confidence.
 */
export function isRdfContent(inputText: string): boolean {
	let trimmed = inputText.trim();
	// Remove comments from the text before analysis
	const cleanedText = trimmed.replace(/^\s*#.*$/gm, '');
	trimmed = cleanedText.trim();
	if (trimmed.startsWith("{") && trimmed.includes('"@context"') && trimmed.includes("csvw")) {
		return false;
	}

	const lines = trimmed.split(/\r?\n/);
	if (lines.length > 1 && lines.every(l => l.split(",").length > 1)) {
		return false;
	}

	if (trimmed.startsWith("{") && trimmed.includes('"@context"')) {
		return true;
	}

	if (trimmed.includes("@prefix")) {
		return true;
	}

	if (trimmed.startsWith("<rdf:RDF")) {
		return true;
	}

	return false;
}

export async function findMetadata(csvUrl: string): Promise<string | null> {
	const csvDir = path.dirname(csvUrl);
	console.log('csvDir:', csvDir);
	const csvBasename = path.basename(csvUrl, path.extname(csvUrl));
	console.log('basename:', csvBasename);
	try {
		const dirUri = vscode.Uri.file(csvDir);
		const files = await vscode.workspace.fs.readDirectory(dirUri);

		const csvMetadataFile = files.find(([name, type]) => name === 'csv-metadata.json');
		if (csvMetadataFile) {
			return path.join(csvDir, csvMetadataFile[0]);
		}

		const metadataFiles = files.filter(([name, type]) =>
			(name.endsWith('.json') || name.endsWith('.jsonld')) &&
			name.includes(csvBasename)
		);

		if (metadataFiles.length > 0) {
			return path.join(csvDir, metadataFiles[0][0]);
		}

		return null;
	} catch (error) {
		throw new Error(`Error finding metadata for ${csvUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}