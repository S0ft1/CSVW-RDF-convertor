import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { openFieldsForConversion } from '../command-handlers.js';

/**
 * Opens conversion fields for a specified conversion
 */
export function registerOpenConversionFields(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.openConversionFields',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			let allFilesOpen = false;
			if (conversion.descriptorFilePath && conversion.inputFilePath && conversion.outputFilePath) {
				const descriptorOpen = vscode.window.visibleTextEditors.some(
					editor => editor.document.uri.fsPath === conversion.descriptorFilePath
				);
				const inputOpen = vscode.window.visibleTextEditors.some(
					editor => editor.document.uri.fsPath === conversion.inputFilePath
				);
				const outputOpen = vscode.window.visibleTextEditors.some(
					editor => editor.document.uri.fsPath === conversion.outputFilePath
				);
				
				// Check if all additional input files are open (if any exist)
				let additionalInputsOpen = true;
				if (conversion.additionalInputFilePaths && conversion.additionalInputFilePaths.length > 0) {
					additionalInputsOpen = conversion.additionalInputFilePaths.every(filePath =>
						vscode.window.visibleTextEditors.some(
							editor => editor.document.uri.fsPath === filePath
						)
					);
				}
				
				allFilesOpen = descriptorOpen && inputOpen && outputOpen && additionalInputsOpen;
			}

			if (allFilesOpen) {
				vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already open`);
				return;
			}

			await openFieldsForConversion(conversion);
			vscode.window.showInformationMessage(`✅ Opened fields for conversion: ${conversion.name}`);
		}
	);
}
