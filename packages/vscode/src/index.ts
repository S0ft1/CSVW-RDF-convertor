import * as vscode from 'vscode';
import { CSVWActionsProvider, loadExistingConversions } from './lib/tree-data-provider.js';
import { registerCommands } from './lib/command-handlers.js';
import { handleConversion } from './lib/conversion-logic.js';

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
				
				// Only process saves to descriptor or input files
				if (changedFilePath === conv.descriptorFilePath || changedFilePath === conv.inputFilePath) {
					conversion = conv;
					break;
				}
			}
		}
		if (!conversion) {
			return; // Not a conversion file, ignore
		}

		const descriptorOpen = vscode.window.visibleTextEditors.some(
			editor => editor.document.uri.fsPath === conversion.descriptorFilePath
		);
		const inputOpen = vscode.window.visibleTextEditors.some(
			editor => editor.document.uri.fsPath === conversion.inputFilePath
		);
		
		// Only require descriptor and input files to be open, output files will be created automatically
		if (descriptorOpen && inputOpen) {
			const descriptorEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document.uri.fsPath === conversion.descriptorFilePath
			);
			const inputEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document.uri.fsPath === conversion.inputFilePath
			);

			if (descriptorEditor && inputEditor) {
				try {
					const descriptorContent = descriptorEditor.document.getText();
					const inputContent = inputEditor.document.getText();

					const templateIRIs = conversion.templateIRIsChecked || false;
					const minimalMode = conversion.minimalModeChecked || false;
					
					const outputFilePaths = await handleConversion(descriptorContent, inputContent, templateIRIs, minimalMode, conversion);

					// Update the conversion structure with the actual output file paths
					if (outputFilePaths.length > 1) {
						conversion.outputFilePaths = outputFilePaths;
					}
					if (outputFilePaths.length >= 1) {
						conversion.outputFilePath = outputFilePaths[0];
					}
					
				} catch (error) {
					
					// Write error to output file for user visibility
					try {
						const errorMessage = `# Auto-conversion Error\n# ${new Date().toISOString()}\n# Error: ${error instanceof Error ? error.message : String(error)}\n\n# Stack trace:\n# ${error instanceof Error && error.stack ? error.stack.split('\n').map(line => `# ${line}`).join('\n') : 'No stack trace available'}\n`;
						
						// Create or update output.ttl with error information
						const outputPath = conversion.outputFilePath 
							? vscode.Uri.file(conversion.outputFilePath)
							: vscode.Uri.file(`${conversion.folderPath}/output.ttl`);
						
						await vscode.workspace.fs.writeFile(outputPath, Buffer.from(errorMessage, 'utf8'));
						
						// Open the error file to show the user
						const errorDocument = await vscode.workspace.openTextDocument(outputPath);
						await vscode.window.showTextDocument(errorDocument, vscode.ViewColumn.Three);
						
						// Update conversion structure
						conversion.outputFilePath = outputPath.fsPath;
					} catch (writeError) {
						vscode.window.showErrorMessage(`Auto-conversion failed: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
			}
		}
	});

	context.subscriptions.push(saveListener);
}

export function deactivate() {}
