import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { getDefaultInputContent } from '../file-utils.js';

/**
 * Adds another input file to a conversion
 */
export function registerAddAnotherInput(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.addAnotherInput',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			if (!conversion.folderPath) {
				vscode.window.showWarningMessage(`Please open fields for "${conversion.name}" first`);
				return;
			}

			try {
				const inputsDir = vscode.Uri.joinPath(vscode.Uri.file(conversion.folderPath), 'inputs');

				let inputNumber = 2;
				let inputFileName: string;
				let inputFilePath: vscode.Uri;

				do {
					inputFileName = `input${inputNumber}.csv`;
					inputFilePath = vscode.Uri.joinPath(inputsDir, inputFileName);

					try {
						await vscode.workspace.fs.stat(inputFilePath);
						inputNumber++;
					} catch {
						break;
					}
				} while (true);

				const defaultContent = getDefaultInputContent(`${conversion.name} - Input ${inputNumber - 1}`);

				const encoder = new TextEncoder();
				await vscode.workspace.fs.writeFile(inputFilePath, encoder.encode(defaultContent));

				const document = await vscode.workspace.openTextDocument(inputFilePath);
				await vscode.window.showTextDocument(document, {
					viewColumn: vscode.ViewColumn.Two,
					preserveFocus: true,
					preview: false
				});

				if (!conversion.additionalInputFilePaths) {
					conversion.additionalInputFilePaths = [];
				}
				conversion.additionalInputFilePaths.push(inputFilePath.fsPath);

				if (conversion.descriptorFilePath) {
					try {
						const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);
						const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
						const decoder = new TextDecoder();
						const descriptorContent = decoder.decode(descriptorBytes);

						const descriptor = JSON.parse(descriptorContent);

						if (!descriptor.tables) {
							descriptor.tables = [];
						}

						const newTable = {
							url: inputFileName,
							tableSchema: {
								columns: []
							}
						};

						descriptor.tables.push(newTable);

						const updatedDescriptorContent = JSON.stringify(descriptor, null, 2);
						const encoderDesc = new TextEncoder();
						await vscode.workspace.fs.writeFile(descriptorUri, encoderDesc.encode(updatedDescriptorContent));

						const descriptorEditor = vscode.window.visibleTextEditors.find(
							editor => editor.document.uri.fsPath === conversion.descriptorFilePath
						);
						if (descriptorEditor) {
							await vscode.commands.executeCommand('workbench.action.files.revert', descriptorUri);
						}

						vscode.window.showInformationMessage(`✅ Added new input file: ${inputFileName} and updated descriptor for "${conversion.name}"`);

					} catch (parseError) {
						vscode.window.showWarningMessage(`⚠️ Added input file but failed to update descriptor: ${parseError}`);
						vscode.window.showInformationMessage(`✅ Added new input file: ${inputFileName} for "${conversion.name}"`);
					}
				} else {
					vscode.window.showInformationMessage(`✅ Added new input file: ${inputFileName} for "${conversion.name}"`);
				}

			} catch (error) {
				vscode.window.showErrorMessage(`❌ Failed to add input file: ${error}`);
			}
		}
	);
}
