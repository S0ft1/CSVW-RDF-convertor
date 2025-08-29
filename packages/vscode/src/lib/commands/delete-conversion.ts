import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';

/**
 * Deletes a conversion and all its associated files
 */
export function registerDeleteConversion(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.deleteConversion',
		async (conversionItem: any) => {
			const conversionId = conversionItem?.id || conversionItem;
			const conversion = csvwActionsProvider.getConversion(conversionId);

			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			const choice = await vscode.window.showWarningMessage(
				`⚠️ Are you sure you want to delete the conversion "${conversion.name}"?\n\nThis will permanently delete all files and cannot be undone.`,
				{ modal: true },
				'Delete Conversion'
			);

			if (choice !== 'Delete Conversion') {
				return;
			}

			try {
				const pathsToClose: string[] = [];

				if (conversion.descriptorFilePath) {
					pathsToClose.push(conversion.descriptorFilePath);
				}

				if (conversion.inputFilePath) {
					pathsToClose.push(conversion.inputFilePath);
				}

				if (conversion.rdfInputFilePath) {
					pathsToClose.push(conversion.rdfInputFilePath);
				}

				if (conversion.additionalInputFilePaths) {
					pathsToClose.push(...conversion.additionalInputFilePaths);
				}

				if (conversion.outputFilePath) {
					pathsToClose.push(conversion.outputFilePath);
				}

				// Also ensure we close rdfInput.ttl even if rdfInputFilePath is not set
				if (conversion.folderPath) {
					const rdfInputPath = vscode.Uri.joinPath(vscode.Uri.file(conversion.folderPath), 'inputs', 'rdfInput.ttl');
					if (!pathsToClose.includes(rdfInputPath.fsPath)) {
						pathsToClose.push(rdfInputPath.fsPath);
					}
				}

				console.log(`Closing ${pathsToClose.length} files for deletion:`, pathsToClose);

				if (pathsToClose.length > 0) {
					const tabsToClose: vscode.Tab[] = [];

					for (const tabGroup of vscode.window.tabGroups.all) {
						for (const tab of tabGroup.tabs) {
							if (tab.input instanceof vscode.TabInputText) {
								if (pathsToClose.includes(tab.input.uri.fsPath)) {
									tabsToClose.push(tab);
								}
							}
						}
					}

					if (tabsToClose.length > 0) {
						console.log(`Closing ${tabsToClose.length} tabs`);
						await vscode.window.tabGroups.close(tabsToClose);
					}
				}

				if (conversion.folderPath) {
					const folderUri = vscode.Uri.file(conversion.folderPath);
					await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false });
				}

				csvwActionsProvider.removeConversion(conversion.id);

				vscode.window.showInformationMessage(`✅ Deleted conversion: ${conversion.name}`);

			} catch (error) {
				vscode.window.showErrorMessage(`❌ Failed to delete conversion: ${error}`);
			}
		}
	);
}
