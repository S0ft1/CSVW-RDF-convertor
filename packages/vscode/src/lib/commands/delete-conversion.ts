import * as vscode from 'vscode';
import type { CSVWActionsProvider } from '../tree-data-provider.js';
import { collectInputFilePaths, closeTabsForPaths } from '../conversion-file-utils.js';

/**
 * Collects all file paths that need to be closed before deletion.
 * Includes input files, output files, and ensures rdfInput.ttl is included.
 * @param conversion - The conversion item to collect paths for
 * @returns Array of file paths to close
 */
function collectAllFilePaths(conversion: any): string[] {
	const pathsToClose = collectInputFilePaths(conversion);

	if (conversion.outputFilePath) {
		pathsToClose.push(conversion.outputFilePath);
	}

	if (conversion.folderPath) {
		const rdfInputPath = vscode.Uri.joinPath(vscode.Uri.file(conversion.folderPath), 'inputs', 'rdfInput.ttl');
		if (!pathsToClose.includes(rdfInputPath.fsPath)) {
			pathsToClose.push(rdfInputPath.fsPath);
		}
	}

	return pathsToClose;
}

/**
 * Deletes a conversion and all its associated files.
 * Closes open tabs, deletes the conversion folder, and removes from tree view.
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable for the registered command
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
				const pathsToClose = collectAllFilePaths(conversion);

				await closeTabsForPaths(pathsToClose);

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
