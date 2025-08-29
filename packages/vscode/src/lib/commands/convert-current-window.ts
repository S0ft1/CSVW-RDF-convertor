import * as vscode from 'vscode';
import * as path from 'path';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { ensureFileExists, getDefaultDescriptorContent, getDefaultInputContent, getDefaultRdfInputContent } from '../file-utils.js';
import { findMetadata } from '../conversion-logic.js';
import { openFieldsForConversion, sanitizeFolderName } from '../command-handlers.js';

/**
 * Creates a conversion from the currently active window/file
 */
export function registerConvertCurrentWindow(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.convertCurrentWindow',
		async () => {
			const activeEditor = vscode.window.activeTextEditor;

			if (!activeEditor) {
				vscode.window.showWarningMessage('⚠️ No active editor found. Please open a file to create a conversion from.');
				return;
			}

			const originalContent = activeEditor.document.getText().trim();

			if (!originalContent) {
				vscode.window.showWarningMessage('⚠️ Active editor is empty. Please add content to convert.');
				return;
			}

			try {
				const fileName = activeEditor.document.fileName || activeEditor.document.uri.path;
				const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "CurrentWindow";
				const defaultName = `${baseName} Conversion`;

				// Prompt user for conversion name
				const conversionName = await vscode.window.showInputBox({
					prompt: 'Enter a name for the new conversion',
					placeHolder: defaultName,
					value: defaultName
				});

				// If user cancels the input, return early
				if (conversionName === undefined) {
					return;
				}

				const finalName = conversionName.trim() || defaultName;
				const conversion = csvwActionsProvider.addConversion(finalName);

				// Create the basic conversion structure first
				const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
				const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');
				const conversionDir = vscode.Uri.joinPath(extensionDir, sanitizeFolderName(conversion.name));
				const inputsDir = vscode.Uri.joinPath(conversionDir, 'inputs');
				const outputsDir = vscode.Uri.joinPath(conversionDir, 'outputs');

				try {
					await vscode.workspace.fs.createDirectory(conversionDir);
					await vscode.workspace.fs.createDirectory(inputsDir);
					await vscode.workspace.fs.createDirectory(outputsDir);
				} catch {
					// Directory already exists
				}

				conversion.folderPath = conversionDir.fsPath;
				const fileExtension = path.extname(fileName).toLowerCase();
				const isRdf = fileExtension !== '.csv';
				let foundMetadataAsString: string | null = null;
				if (!isRdf) {

					const metadataPath = await findMetadata(activeEditor.document.uri.path);
					if (metadataPath) {
						try {
							const metadataUri = vscode.Uri.file(metadataPath);
							const metadataBytes = await vscode.workspace.fs.readFile(metadataUri);
							const decoder = new TextDecoder();
							foundMetadataAsString = decoder.decode(metadataBytes);
						} catch (err) {
							console.warn("Could not read associated metadata file: " + metadataPath, err);
						}
					}
					const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
					conversion.descriptorFilePath = descriptorPath.fsPath;
					await ensureFileExists(descriptorPath, foundMetadataAsString ?? getDefaultDescriptorContent());
				}
				else{
					const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
					conversion.descriptorFilePath = descriptorPath.fsPath;
					await ensureFileExists(descriptorPath, "");
				}

				if (isRdf) {
					const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
					await vscode.workspace.fs.writeFile(rdfInputPath, new TextEncoder().encode(originalContent));
					conversion.rdfInputFilePath = rdfInputPath.fsPath;

					const csvInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
					await ensureFileExists(csvInputPath, getDefaultInputContent(conversion.name));
					conversion.inputFilePath = csvInputPath.fsPath;
				} else {
					const csvInputPath = vscode.Uri.joinPath(inputsDir, baseName+".csv");
					await vscode.workspace.fs.writeFile(csvInputPath, new TextEncoder().encode(originalContent));
					conversion.inputFilePath = csvInputPath.fsPath;

					const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
					await ensureFileExists(rdfInputPath, getDefaultRdfInputContent(conversion.name));
					conversion.rdfInputFilePath = rdfInputPath.fsPath;
				}
				// Now open the fields normally - the files are already correctly set up
				await openFieldsForConversion(conversion);

				const fileType = isRdf ? 'RDF' : 'CSV';
				vscode.window.showInformationMessage(`✅ Created conversion "${conversion.name}" from ${fileType} file!`);



			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
				vscode.window.showErrorMessage(`❌ Failed to create conversion: ${errorMessage}`);
				console.error('CSVW Conversion Creation Error:', error);
			}
		}
	);
}
