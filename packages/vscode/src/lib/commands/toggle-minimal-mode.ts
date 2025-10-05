import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { validateConversionExists } from '../conversion-utils.js';

/**
 * Registers the toggle Minimal Mode command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable for the registered command
 */
export function registerToggleMinimalMode(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleMinimalMode',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!validateConversionExists(conversion)) {
				return;
			}

			conversion.minimalMode = !conversion.minimalMode;
			csvwActionsProvider.refresh();
		}
	);
}
