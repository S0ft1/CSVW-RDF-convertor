import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { convertRDF2CSVW } from '../conversion-logic.js';
import { ConversionItem } from '../types.js';
import { 
	validateConversionExists, 
	ensureConversionPaths, 
	readDescriptorContent, 
	updateConversionState, 
	openOutputFiles, 
	handleConversionError 
} from './conversion-utils.js';

/**
 * Performs the RDF to CSVW conversion process
 * @param conversion - The conversion item to process
 */
async function performRdfToCsvwConversion(conversion: ConversionItem): Promise<void> {
	ensureConversionPaths(conversion);
	
	const descriptorContent = await readDescriptorContent(conversion);
	
	const outputFilePaths = await convertRDF2CSVW(descriptorContent, conversion.rdfInputFilePath!, conversion);
	
	updateConversionState(conversion, outputFilePaths);
	await openOutputFiles(outputFilePaths);
	
	vscode.window.showInformationMessage(`✅ RDF→CSVW conversion completed for: ${conversion.name}`);
}

/**
 * Registers the RDF to CSVW conversion command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable for the registered command
 */
export function registerConvertRdfToCsvw(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.convertRdfToCsvw',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!validateConversionExists(conversion)) {
				return;
			}

			try {
				await performRdfToCsvwConversion(conversion);
			} catch (error) {
				await handleConversionError(conversion, error, 'RDF→CSVW');
			}
		}
	);
}
