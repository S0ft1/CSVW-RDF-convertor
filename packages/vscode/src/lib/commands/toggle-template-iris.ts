import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { validateConversionExists } from '../conversion-utils.js';

/**
 * Registers the toggle Template IRIs command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable for the registered command
 */
export function registerToggleTemplateIRIs(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleTemplateIRIs',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!validateConversionExists(conversion)) {
				return;
			}

			conversion.templateIRIsChecked = !conversion.templateIRIsChecked;
			csvwActionsProvider.refresh();
		}
	);
}
