import { csvwDescriptorToRdf, CsvwRow, CsvwTable, defaultResolveJsonldFn, defaultResolveStreamFn, defaultResolveTextFn, DescriptorWrapper, parseRdf, Rdf2CsvOptions, rdfStreamToArray, rdfToCsvw, serializeRdf } from '@csvw-rdf-convertor/core'
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core'
import { ConversionItem, MiniOptions } from './types.js';
import { isAbsolute, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as csv from 'csv';
import { Readable } from 'node:stream';
import fs from 'node:fs';
/**
 * Converts RDF data to CSVW format using CSVW metadata.
 * @param descriptorText - The CSVW metadata descriptor content.
 * @param inputPath - Path to the RDF data file.
 * @param descriptorPath - Path to the descriptor file.
 * @param conversion - The conversion object with additional options.
 * @returns Promise containing created table file names.
 */
export async function convertRDF2CSVW(descriptorText: string, inputPath: string, conversion: ConversionItem): Promise<string[]> {
	const options: Rdf2CsvOptions = {
		baseIri: conversion.folderPath,
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
		baseIri: conversion.folderPath, resolveStreamFn(path, base) {
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
	const stringifiers: { [table: string]: csv.stringifier.Stringifier } = {};
	let descriptor: DescriptorWrapper;
	let table: CsvwTable;
	let row: CsvwRow;
	let tableNames = [];
	for await ([descriptor, table, row] of stream) {
		if (stringifiers[table.name] === undefined) {
			const tableFilePath = resolve(conversion.folderPath, table.name)
			console.log("Creating table file:", tableFilePath)
			const outputStream = fs.createWriteStream(
				tableFilePath
			);
			//const outputStream = stdout;
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
		console.log("Writing row to table:", table.name, row);
		stringifiers[table.name].write(row);
	}
	console.log("Finished writing tables.");
	console.log("tableNames:", tableNames)
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
	const getUrl = (path: string, base: string) =>
		URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
	const csvw2RdfOptions: Csvw2RdfOptions = {
		templateIris: options.templateIris,
		minimal: options.minimal,
		baseIri: conversion.folderPath,
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
		if (conversion.descriptorFilePath && conversion.outputFilePath) {
			const rdfStream = csvwDescriptorToRdf(descriptorText, csvw2RdfOptions);
			//const result = serializeRdf(rdfStream, { format: 'turtle' });
			const result = await rdfStreamToArray(rdfStream);
			console.log("result:", result)
			const outputText = await new Promise<string>((resolve, reject) => {
				let rdfData = '';

				rdfStream.on('data', (chunk) => {
					console.log("chunk:", chunk.toString(), typeof chunk)
					rdfData += chunk.toString();
				});

				rdfStream.on('end', () => {
					resolve(rdfData);
				});

				rdfStream.on('error', (error) => {
					reject(error);
				});
			});

			// Write the RDF data to the output file
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
 * Main conversion handler that determines input format and routes to appropriate converter.
 * Automatically detects whether input is RDF or CSV and applies the correct conversion.
 * @param descriptorText - The CSVW metadata descriptor content.
 * @param inputText - The input data content to analyze and convert.
 * @param templateIRIs - Whether to enable template IRIs in the conversion.
 * @param minimalMode - Whether to use minimal mode for reduced output.
 * @param conversion - The conversion object containing additional context and file paths.
 * @returns Promise resolving to array of output file paths.
 */
export async function handleConversion(descriptorText: string, inputText: string, templateIRIs: boolean = false, minimalMode: boolean = false, conversion: ConversionItem): Promise<string[]> {
	const options: MiniOptions = {
		templateIris: templateIRIs,
		minimal: minimalMode
	};

	const isRdf = isRdfContent(inputText);
	console.log("detection:", isRdf)
	let outputFilePaths: string[];
	if (isRdf) {
		outputFilePaths = await convertRDF2CSVW(descriptorText, conversion.inputFilePath, conversion);
	} else {
		outputFilePaths = await convertCSVW2RDF(descriptorText, options, conversion);
	}

	return outputFilePaths;
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
