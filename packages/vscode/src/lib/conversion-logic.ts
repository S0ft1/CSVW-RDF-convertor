import { csvUrlToRdf } from '@csvw-rdf-convertor/core'
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core'
import { MiniOptions } from './types.js';

/**
 * Converts RDF data to CSVW format using CSVW metadata.
 * @param descriptorText - The CSVW metadata descriptor content.
 * @param inputPath - Path to the RDF data file.
 * @param descriptorPath - Path to the descriptor file.
 * @param conversion - The conversion object with additional options.
 * @returns Promise resolving to the converted CSVW result.
 */
export async function convertRDF2CSVW(descriptorText: string, inputPath: string, descriptorPath: string, conversion: any): Promise<string> {
	// TODO: Implement RDF to CSVW conversion logic here
	// This function will handle converting RDF data to CSV format using CSVW metadata
	// Parameters:
	// - descriptorText: CSVW metadata descriptor
	// - inputPath: Path to RDF data file
	// - descriptorPath: Path to descriptor file
	// - conversion: Conversion object with options
	return "RDF to CSVW conversion result will be implemented here";
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
 * Uses multiple heuristics including syntax patterns, file structure, and content analysis.
 * @param inputText - The text content to analyze.
 * @returns Object containing isRdf boolean and isRecognized boolean indicating detection confidence.
 */
export function isRdfContent(inputText: string): { isRdf: boolean, isRecognized: boolean } {
	const trimmedContent = inputText.trim();
	const lowerContent = trimmedContent.toLowerCase();
	
	const lines = trimmedContent.split('\n').filter(line => line.trim().length > 0);
	if (lines.length > 0) {
		const firstLine = lines[0].trim();
		
		if (firstLine.includes(',')) {
			if (!firstLine.includes('<') && 
				!firstLine.includes('@') &&
				!firstLine.includes('xmlns') &&
				!firstLine.includes('http://') &&
				!firstLine.includes('https://')) {
				if (lines.length > 1) {
					const secondLine = lines[1].trim();
					const firstCommaCount = (firstLine.match(/,/g) || []).length;
					const secondCommaCount = (secondLine.match(/,/g) || []).length;
					if (Math.abs(firstCommaCount - secondCommaCount) <= 1) {
						return { isRdf: false, isRecognized: true };
					}
				}
				return { isRdf: false, isRecognized: true };
			}
		}
		
		if ((firstLine.includes('\t') || firstLine.includes(';')) &&
			!firstLine.includes('<') && 
			!firstLine.includes('@') &&
			!firstLine.includes('http://') &&
			!firstLine.includes('https://')) {
			return { isRdf: false, isRecognized: true };
		}
	}
	
	if (lowerContent.includes('@prefix') || 
		lowerContent.includes('@base') ||
		trimmedContent.match(/<[^>]*>\s+<[^>]*>\s+<[^>]*>/)) {
		return { isRdf: true, isRecognized: true };
	}
	
	if (trimmedContent.match(/(<[^>]+>|\w+:\w+)\s+a\s+(<[^>]+>|\w+:\w+)/)) {
		return { isRdf: true, isRecognized: true };
	}
	
	if (lowerContent.includes('<rdf:') ||
		lowerContent.includes('xmlns:rdf') ||
		lowerContent.includes('rdf:about') ||
		lowerContent.includes('rdf:resource')) {
		return { isRdf: true, isRecognized: true };
	}
	
	if (trimmedContent.match(/<[^>]*>\s+<[^>]*>\s+[^.]*\s*\./)) {
		return { isRdf: true, isRecognized: true };
	}
	
	try {
		const parsed = JSON.parse(inputText);
		if (parsed['@context'] || parsed['@graph'] || parsed['@id'] || parsed['@type']) {
			return { isRdf: true, isRecognized: true };
		}
	} catch {
		// Not valid JSON, continue with other checks
	}
	
	return { isRdf: false, isRecognized: false };
}
