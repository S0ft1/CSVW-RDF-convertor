import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { ConversionItem } from '../types.js';
import { collectInputFilePaths, collectOutputFilePaths, findTabsToClose } from '../conversion-file-utils.js';

/**
 * Clears all conversion state after closing files
 * @param conversion - The conversion item to reset
 */
function clearConversionState(conversion: ConversionItem): void {
	conversion.additionalInputFilePaths = [];
	conversion.outputFilePath = undefined;
	conversion.outputFilePaths = undefined;
}

/**
 * Shows appropriate success message based on number of files closed
 * @param conversion - The conversion item being processed
 * @param fileCount - Number of files that were closed
 */
function showSuccessMessage(conversion: ConversionItem, fileCount: number): void {
	if (fileCount === 0) {
		vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already closed`);
	} else {
		const fileText = fileCount === 1 ? 'file' : 'files';
		vscode.window.showInformationMessage(`✅ Closed ${fileCount} ${fileText} for conversion: ${conversion.name}`);
	}
}

/**
 * Registers the close conversion fields command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable for the registered command
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

			const inputPaths = collectInputFilePaths(conversion);
			const outputPaths = await collectOutputFilePaths(conversion);
			const allPathsToClose = [...inputPaths, ...outputPaths];

			if (allPathsToClose.length === 0) {
				showSuccessMessage(conversion, 0);
				return;
			}

			const tabsToClose = findTabsToClose(allPathsToClose);
			if (tabsToClose.length > 0) {
				await vscode.window.tabGroups.close(tabsToClose);
			}

			clearConversionState(conversion);

			showSuccessMessage(conversion, allPathsToClose.length);
		}
	);
}
