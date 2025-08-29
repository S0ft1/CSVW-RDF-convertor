import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';

/**
 * Toggles the Template IRIs option for a conversion
 */
export function registerToggleTemplateIRIs(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleTemplateIRIs',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			conversion.templateIRIsChecked = !conversion.templateIRIsChecked;

			csvwActionsProvider.refresh();
		}
	);
}
