import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { openFieldsForConversion } from '../command-handlers.js';

/**
 * Adds a new conversion with user-provided name
 */
export function registerAddNewConversion(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.addNewConversion',
		async () => {
			const conversionName = await vscode.window.showInputBox({
				prompt: 'Enter a name for the new conversion',
				placeHolder: 'My Conversion'
			});

			const conversion = csvwActionsProvider.addConversion(conversionName || undefined);
			await openFieldsForConversion(conversion);
			vscode.window.showInformationMessage(`✅ Created new conversion: ${conversion.name}`);
		}
	);
}
