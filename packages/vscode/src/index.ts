import * as vscode from 'vscode';
import { CSVWActionsProvider, loadExistingConversions } from './lib/tree-data-provider.js';
import { registerCommands, updateInputFilesFromDescriptor } from './lib/command-handlers.js';
import { convertRDF2CSVW, convertCSVW2RDF } from './lib/conversion-logic.js';
export async function activate(context: vscode.ExtensionContext) {

	const csvwActionsProvider = new CSVWActionsProvider();

	vscode.window.createTreeView('csvw-rdf-actions', {
		treeDataProvider: csvwActionsProvider,
		canSelectMany: false
	});

	vscode.commands.registerCommand('csvwrdfconvertor.refreshActions', () => {
		csvwActionsProvider.refresh();
	});

	await loadExistingConversions(csvwActionsProvider);

	registerCommands(context, csvwActionsProvider);

	const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {

		const changedFilePath = document.uri.fsPath;
		let conversion = null;

		const conversions = csvwActionsProvider.getAllConversions();

		for (const conv of conversions) {
			if (conv) {
				if (changedFilePath === conv.outputFilePath) {
					return; // Don't do anything for output file changes
				}
				if (conv.outputFilePaths && conv.outputFilePaths.includes(changedFilePath)) {
					return; // Don't do anything for output file changes
				}

				// Process saves to descriptor, CSV input files, or RDF input file
				if (changedFilePath === conv.descriptorFilePath ||
					changedFilePath === conv.inputFilePath ||
					changedFilePath === conv.rdfInputFilePath ||
					(conv.additionalInputFilePaths && conv.additionalInputFilePaths.includes(changedFilePath))) {
					conversion = conv;
					break;
				}
			}
		}
		if (!conversion) {
			return; // Not a conversion file, ignore
		}

		// If descriptor was saved, update input files based on table URLs
		if (changedFilePath === conversion.descriptorFilePath) {
			const descriptorEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document.uri.fsPath === conversion.descriptorFilePath
			);

			if (descriptorEditor) {
				const descriptorContent = descriptorEditor.document.getText();
				await updateInputFilesFromDescriptor(conversion, descriptorContent);
			}
			return; // Don't trigger conversion for descriptor saves, only update input files
		}

		// Determine conversion direction based on which file was saved
		let isRdfToCSVW = false;
		if (changedFilePath === conversion.rdfInputFilePath) {
			isRdfToCSVW = true;
		}
		console.log(`Auto-conversion triggered for ${isRdfToCSVW ? 'RDF→CSVW' : 'CSVW→RDF'} on save of ${changedFilePath}`);
		//vscode.commands.executeCommand('csvwrdfconvertor.openConversionFields');

		// Check which files are open for conversion
		const descriptorEditor = vscode.window.visibleTextEditors.find(
			editor => editor.document.uri.fsPath === conversion.descriptorFilePath
		);
		console.log("descriptorEditor: " + descriptorEditor);
		if (descriptorEditor) {
			try {
				console.log("in descriptorEditor")
				const descriptorContent = descriptorEditor.document.getText();
				console.log(descriptorContent);
				const templateIRIs = conversion.templateIRIsChecked || false;
				const minimalMode = conversion.minimalModeChecked || false;

				let outputFilePaths: string[];

				if (isRdfToCSVW) {
					// Use RDF->CSVW conversion
					console.log(conversion.rdfInputFilePath);
					outputFilePaths = await convertRDF2CSVW(descriptorContent, conversion.rdfInputFilePath, conversion);
				} else {
					// Use CSVW->RDF conversion
					console.log(conversion.folderPath);
					outputFilePaths = await convertCSVW2RDF(descriptorContent, { templateIris: templateIRIs, minimal: minimalMode }, conversion);
				}

				   // Update the conversion structure with the actual output file paths
				   if (outputFilePaths.length > 1) {
					   conversion.outputFilePaths = outputFilePaths;
				   }
				   else if (outputFilePaths.length == 1) {
					   conversion.outputFilePath = outputFilePaths[0];
				   }

				   // Clear any previous error file since conversion was successful
				   conversion.errorFilePath = undefined;

				   // Open all output files in the third column
				   if (outputFilePaths.length > 0) {
					   // Store the output files that we're showing to the user
					   conversion.lastShownOutputFiles = [...outputFilePaths];
					   
					   for (const outputFilePath of outputFilePaths) {
						   const outputUri = vscode.Uri.file(outputFilePath);
						   // If already open, revert to reload
						   const outputEditor = vscode.window.visibleTextEditors.find(
							   editor => editor.document.uri.fsPath === outputFilePath
						   );
						   if (outputEditor) {
							   await vscode.commands.executeCommand('workbench.action.files.revert', outputUri);
						   }
						   await vscode.window.showTextDocument(outputUri, { viewColumn: vscode.ViewColumn.Three, preview: false });
					   }
				   }

			} catch (error) {

				// Write error to dedicated error file for user visibility
				try {
					const conversionDirection = isRdfToCSVW ? 'RDF→CSVW' : 'CSVW→RDF';
					const errorMessage = `# Auto-conversion Error (${conversionDirection})\n# ${new Date().toISOString()}\n# Error: ${error instanceof Error ? error.message : String(error)}\n\n# Stack trace:\n# ${error instanceof Error && error.stack ? error.stack.split('\n').map(line => `# ${line}`).join('\n') : 'No stack trace available'}\n`;

					// Create error.txt in outputs directory
					const errorPath = vscode.Uri.file(`${conversion.folderPath}/outputs/error.txt`);

					await vscode.workspace.fs.writeFile(errorPath, Buffer.from(errorMessage, 'utf8'));

					// Open the error file to show the user
					const errorDocument = await vscode.workspace.openTextDocument(errorPath);
					await vscode.window.showTextDocument(errorDocument, vscode.ViewColumn.Three);

					// Update conversion structure with error file path
					conversion.errorFilePath = errorPath.fsPath;
					
					// Don't set outputFilePath when there's an error - this prevents output.ttl from being shown
					// The error.txt will be the visible output instead
				} catch (writeError) {
					const conversionDirection = isRdfToCSVW ? 'RDF→CSVW' : 'CSVW→RDF';
					vscode.window.showErrorMessage(`Auto-conversion failed (${conversionDirection}): ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}

		context.subscriptions.push(saveListener);
	});
}
export function deactivate() { }
