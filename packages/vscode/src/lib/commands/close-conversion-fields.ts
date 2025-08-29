import * as vscode from 'vscode';
import * as path from 'path';
import { CSVWActionsProvider } from '../tree-data-provider.js';

/**
 * Closes all files associated with a conversion
 */
export function registerCloseConversionFields(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.closeConversionFields',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			const pathsToClose: string[] = [];

			// Add input files to close
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

			// Find and add ALL files from the outputs directory
			try {
				const outputsDir = path.join(conversion.folderPath, 'outputs');
				const outputsDirUri = vscode.Uri.file(outputsDir);

				try {
					const outputFiles = await vscode.workspace.fs.readDirectory(outputsDirUri);
					for (const [fileName, fileType] of outputFiles) {
						if (fileType === vscode.FileType.File) {
							const filePath = path.join(outputsDir, fileName);
							pathsToClose.push(filePath);
						}
					}
				} catch (dirError) {
					// Outputs directory might not exist, that's okay
					console.log('Outputs directory not found or empty:', dirError);
				}
			} catch (error) {
				console.log('Error reading outputs directory:', error);
			}

			if (pathsToClose.length === 0) {
				vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already closed`);
				return;
			}

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
				await vscode.window.tabGroups.close(tabsToClose);
			}

			conversion.descriptorEditor = undefined;
			conversion.inputEditor = undefined;
			conversion.outputEditor = undefined;
			conversion.additionalInputFilePaths = [];
			conversion.errorFilePath = undefined;
			conversion.outputFilePath = undefined;
			conversion.outputFilePaths = undefined;

			const fileCount = pathsToClose.length;
			const fileText = fileCount === 1 ? 'file' : 'files';
			vscode.window.showInformationMessage(`✅ Closed ${fileCount} ${fileText} for conversion: ${conversion.name}`);
		}
	);
}
