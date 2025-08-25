import * as vscode from 'vscode';
import { CSVWActionsProvider, loadExistingConversions } from './lib/tree-data-provider.js';
import { registerCommands } from './lib/command-handlers.js';

export async function activate(context: vscode.ExtensionContext) {

	const csvwActionsProvider = new CSVWActionsProvider();

	vscode.window.createTreeView('csvw-rdf-actions', {
		treeDataProvider: csvwActionsProvider,
		canSelectMany: false
	});

	vscode.commands.registerCommand('csvwrdfconvertor.refreshActions', () => {
		csvwActionsProvider.refresh();
	});

	await loadExistingConversions(csvwActionsProvider);

	registerCommands(context, csvwActionsProvider);

	const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
		if (event.contentChanges.length === 0) {
			return;
		}

		const changedFilePath = event.document.uri.fsPath;
		let conversion = null;

		for (let i = 1; i < csvwActionsProvider.conversionCounter; i++) {
			const conv = csvwActionsProvider.getConversion(`conversion-${i}`);
			if (conv && (changedFilePath === conv.descriptorFilePath || changedFilePath === conv.inputFilePath)) {
				conversion = conv;
				break;
			}
		}

		if (!conversion) {
			return; // Not a conversion file, ignore
		}

		const descriptorOpen = vscode.window.visibleTextEditors.some(
			editor => editor.document.uri.fsPath === conversion.descriptorFilePath
		);
		const inputOpen = vscode.window.visibleTextEditors.some(
			editor => editor.document.uri.fsPath === conversion.inputFilePath
		);
		const outputOpen = vscode.window.visibleTextEditors.some(
			editor => editor.document.uri.fsPath === conversion.outputFilePath
		);

		if (descriptorOpen && inputOpen && outputOpen) {
			const descriptorEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document.uri.fsPath === conversion.descriptorFilePath
			);
			const inputEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document.uri.fsPath === conversion.inputFilePath
			);
			const outputEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document.uri.fsPath === conversion.outputFilePath
			);

			if (descriptorEditor && inputEditor && outputEditor) {
				try {
					const descriptorContent = descriptorEditor.document.getText();
					const inputContent = inputEditor.document.getText();

					const templateIRIs = conversion.templateIRIsChecked || false;
					const minimalMode = conversion.minimalModeChecked || false;

					const { handleConversion } = await import('./lib/conversion-logic.js');
					const convertedOutput = await handleConversion(descriptorContent, inputContent, templateIRIs, minimalMode, conversion);

					await outputEditor.edit(editBuilder => {
						const firstLine = outputEditor.document.lineAt(0);
						const lastLine = outputEditor.document.lineAt(outputEditor.document.lineCount - 1);
						const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
						editBuilder.replace(fullRange, convertedOutput);
					});
				} catch (error) {
					console.error('Auto-conversion failed:', error);
				}
			}
		}
	});

	context.subscriptions.push(changeListener);
}

export function deactivate() {}
