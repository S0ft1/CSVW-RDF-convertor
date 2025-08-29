import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';

/**
 * Toggles the Minimal Mode option for a conversion
 */
export function registerToggleMinimalMode(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleMinimalMode',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			conversion.minimalModeChecked = !conversion.minimalModeChecked;

			csvwActionsProvider.refresh();
		}
	);
}
