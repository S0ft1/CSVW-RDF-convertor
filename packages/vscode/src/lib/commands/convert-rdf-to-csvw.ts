import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { convertRDF2CSVW } from '../conversion-logic.js';

/**
 * Converts RDF to CSVW for a specified conversion
 */
export function registerConvertRdfToCsvw(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.convertRdfToCsvw',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			try {
				// Ensure necessary file paths are set for RDF→CSVW conversion
				if (!conversion.descriptorFilePath) {
					conversion.descriptorFilePath = `${conversion.folderPath}/descriptor.jsonld`;
				}
				if (!conversion.rdfInputFilePath) {
					conversion.rdfInputFilePath = `${conversion.folderPath}/inputs/rdfInput.ttl`;
				}

				const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);

				const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
				const decoder = new TextDecoder();
				const descriptorContent = decoder.decode(descriptorBytes);
				console.log("descriptorContent: " + descriptorContent);

				const outputFilePaths = await convertRDF2CSVW(descriptorContent, conversion.rdfInputFilePath, conversion);

				// Update the conversion structure with the actual output file paths
				conversion.outputFilePaths = outputFilePaths;
				if (outputFilePaths.length === 1) {
					conversion.outputFilePath = outputFilePaths[0];
				}

				// Clear any previous error file since conversion was successful
				conversion.errorFilePath = undefined;

				// Store the output files that we're showing to the user
				conversion.lastShownOutputFiles = [...outputFilePaths];

				// Open all output files in the third column
				for (const outputFilePath of outputFilePaths) {
					const outputUri = vscode.Uri.file(outputFilePath);

					const outputEditor = vscode.window.visibleTextEditors.find(
						editor => editor.document.uri.fsPath === outputFilePath
					);
					if (outputEditor) {
						await vscode.commands.executeCommand('workbench.action.files.revert', outputUri);
					}

					// Open the file in the third column
					await vscode.window.showTextDocument(outputUri, {
						viewColumn: vscode.ViewColumn.Three,
						preserveFocus: false
					});
				}

				vscode.window.showInformationMessage(`✅ RDF→CSVW conversion completed for: ${conversion.name}`);
			} catch (error) {
				// Write error to dedicated error file for user visibility
				try {
					const errorMessage = `# Manual Conversion Error (RDF→CSVW)\n# ${new Date().toISOString()}\n# Error: ${error instanceof Error ? error.message : String(error)}\n\n# Stack trace:\n# ${error instanceof Error && error.stack ? error.stack.split('\n').map(line => `# ${line}`).join('\n') : 'No stack trace available'}\n`;

					// Create error.txt in outputs directory
					const errorPath = vscode.Uri.file(`${conversion.folderPath}/outputs/error.txt`);

					await vscode.workspace.fs.writeFile(errorPath, Buffer.from(errorMessage, 'utf8'));

					// Open the error file to show the user
					const errorDocument = await vscode.workspace.openTextDocument(errorPath);
					await vscode.window.showTextDocument(errorDocument, vscode.ViewColumn.Three);

					// Update conversion structure with error file path
					conversion.errorFilePath = errorPath.fsPath;

					// Clear output files since there was an error
					conversion.outputFilePath = undefined;
					conversion.outputFilePaths = undefined;
					conversion.lastShownOutputFiles = [errorPath.fsPath];
				} catch (writeError) {
					vscode.window.showErrorMessage(`❌ RDF→CSVW conversion failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	);
}
