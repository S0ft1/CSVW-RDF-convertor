import { csvUrlToRdf, CsvwTableStreams, defaultResolveJsonldFn, defaultResolveStreamFn, DescriptorWrapper, parseRdf, Rdf2CsvOptions, Rdf2CsvwConvertor, rdfToCsvw } from '@csvw-rdf-convertor/core'
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core'
import { MiniOptions } from './types.js';
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
 * @returns Promise resolving to the converted CSVW result.
 */
export async function convertRDF2CSVW(descriptorText: string, inputPath: string, descriptorPath: string, conversion: any): Promise<string> {
	const options: Rdf2CsvOptions = {
		baseIri: conversion.folderPath,
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

	let streams: CsvwTableStreams ;
	let descriptor: DescriptorWrapper ;
	[streams, descriptor]= await rdfToCsvw(rdfStream, options)

	let outputText: string = '';
	for (const [tableName, [columns, stream]] of Object.entries(streams)) {
		const normalizedDescriptor = descriptor?.descriptor ?? {};
		const dialect = normalizedDescriptor.dialect ?? {};
		const descriptorOptions = {
			header: dialect.header ?? true,
			columns: columns.map((column) => ({
				key: column.queryVariable,
				header: column.title,
			})),
			...(dialect.delimiter !== undefined && { delimiter: dialect.delimiter }),
			...(dialect.doubleQuote !== undefined && { escape: dialect.doubleQuote ? '"' : '\\' }),
			...((dialect.quoteChar !== undefined && dialect.quoteChar !== null) && { quote: dialect.quoteChar }),
		};
		const stringifier = csv.stringify(descriptorOptions);
		stringifier.pipe(process.stdout);
		console.log("pred for awaitem")
		console.log("stream: " + stream)
		for await (const bindings of stream) {
			console.log("v for awaitu")
			const row = {} as { [key: string]: string };
			for (const [key, value] of bindings) {
				row[key.value] = value.value;
			}
			console.log(`Row: ${row}`);
			stringifier.write(row);
		}
	}
	return outputText;
}

/**
 * Converts CSV data to RDF format using CSVW metadata and specified options.
 * @param descriptorText - The CSVW metadata descriptor content.
 * @param options - Conversion options including template IRIs and minimal mode settings.
 * @param conversion - The conversion object containing file paths and additional context.
 * @returns Promise resolving to the converted RDF output.
 */
export async function convertCSVW2RDF(descriptorText: string, options: MiniOptions, conversion: any): Promise<string> {
	const csvw2RdfOptions: Csvw2RdfOptions = {
		templateIris: options.templateIris,
		minimal: options.minimal
	};

	try {
		if (conversion.inputFilePath) {
			const inputFileUrl = `file://${conversion.inputFilePath.replace(/\\/g, '/')}`;
			const rdfStream = csvUrlToRdf(inputFileUrl, csvw2RdfOptions);

			return new Promise<string>((resolve, reject) => {
				let rdfData = '';

				rdfStream.on('data', (chunk) => {
					rdfData += chunk.toString();
				});

				rdfStream.on('end', () => {
					console.log('RDF conversion completed, total length:', rdfData.length);
					resolve(rdfData);
				});

				rdfStream.on('error', (error) => {
					console.error('Error in RDF stream:', error);
					reject(error);
				});
			});
		} else {
			return `RDF conversion (no file URL available)\nTemplate IRIs: ${options.templateIris ? 'enabled' : 'disabled'}\nMinimal Mode: ${options.minimal ? 'enabled' : 'disabled'}`;
		}
	} catch (error) {
		console.error('Error in CSV to RDF conversion:', error);
		return `Error in CSV to RDF conversion: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
 * @returns Promise resolving to the converted output.
 */
export async function handleConversion(descriptorText: string, inputText: string, templateIRIs: boolean = false, minimalMode: boolean = false, conversion: any): Promise<string> {
	const options: MiniOptions = {
		templateIris: templateIRIs,
		minimal: minimalMode
	};

	const detection = isRdfContent(inputText);

	if (!detection.isRecognized) {
		console.warn('⚠️ Warning: Input content format could not be recognized as either RDF or CSV. Please verify your input data format.');
	}

	const isRdf = detection.isRdf;
	console.log(isRdf)
	let outputText: string;
	if (isRdf) {
		outputText = await convertRDF2CSVW(descriptorText, conversion.inputFilePath, conversion.descriptorFilePath, conversion);
	} else {
		outputText = await convertCSVW2RDF(descriptorText, options, conversion);
	}

	return outputText;
}

/**
 * Analyzes input text content to determine if it's RDF or CSV format.
 * Simple format detection focused on distinguishing between RDF and CSV.
 * @param inputText - The text content to analyze.
 * @returns Object containing isRdf boolean and isRecognized boolean indicating detection confidence.
 */
export function isRdfContent(inputText: string): { isRdf: boolean, isRecognized: boolean } {
	const trimmedContent = inputText.trim();
	const lowerContent = trimmedContent.toLowerCase();

	if (!trimmedContent) {
		return { isRdf: false, isRecognized: false };
	}

	// Quick RDF format checks
	// JSON-LD indicators
	if (lowerContent.includes('"@context"') ||
		lowerContent.includes('"@graph"') ||
		lowerContent.includes('"@id"') ||
		lowerContent.includes('"@type"')) {
		return { isRdf: true, isRecognized: true };
	}

	// Turtle/N3 indicators
	if (lowerContent.includes('@prefix') ||
		lowerContent.includes('@base')) {
		return { isRdf: true, isRecognized: true };
	}

	// RDF/XML indicators
	if (lowerContent.includes('<rdf:') ||
		lowerContent.includes('xmlns:rdf') ||
		lowerContent.includes('rdf:about') ||
		lowerContent.includes('rdf:resource')) {
		return { isRdf: true, isRecognized: true };
	}

	// Triple patterns (subject predicate object)
	if (trimmedContent.match(/<[^>]+>\s+<[^>]+>\s+<[^>]+>/) ||
		trimmedContent.match(/\w+:\w+\s+\w+:\w+\s+\w+:\w+/) ||
		trimmedContent.match(/(<[^>]+>|\w+:\w+)\s+a\s+(<[^>]+>|\w+:\w+)/)) {
		return { isRdf: true, isRecognized: true };
	}

	// CSV indicators - check for comma-separated structure
	const lines = trimmedContent.split('\n').filter(line => line.trim());
	if (lines.length > 0) {
		const firstLine = lines[0].trim();

		// If it has commas and looks like tabular data
		if (firstLine.includes(',')) {
			// Make sure it's not RDF that happens to contain commas
			if (!firstLine.includes('<') &&
				!firstLine.includes('@') &&
				!firstLine.includes(':') &&
				lines.length > 1) {
				const secondLine = lines[1].trim();
				const firstCommaCount = (firstLine.match(/,/g) || []).length;
				const secondCommaCount = (secondLine.match(/,/g) || []).length;
				// Similar comma counts suggest CSV structure
				if (Math.abs(firstCommaCount - secondCommaCount) <= 1) {
					return { isRdf: false, isRecognized: true };
				}
			}
		}

		// Tab or semicolon separated values
		if ((firstLine.includes('\t') || firstLine.includes(';')) &&
			!firstLine.includes('<') &&
			!firstLine.includes('@') &&
			!firstLine.includes('://')) {
			return { isRdf: false, isRecognized: true };
		}
	}

	// Default: if no clear RDF indicators and has comma/tab structure, assume CSV
	if (trimmedContent.includes(',') || trimmedContent.includes('\t')) {
		return { isRdf: false, isRecognized: false }; // Guess CSV but not confident
	}

	// If nothing matches clearly, default to CSV (most common case)
	return { isRdf: false, isRecognized: false };
}
