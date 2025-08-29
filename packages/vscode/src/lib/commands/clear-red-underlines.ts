import * as vscode from 'vscode';
import { areInputFieldsOpen, clearRedUnderlines } from '../editor-utils.js';

/**
 * Clears red underlines from the active editor
 */
export function registerClearRedUnderlines(): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.clearRedUnderlines',
		async () => {
			if (!areInputFieldsOpen()) {
				vscode.window.showWarningMessage('Please open input fields first by clicking "Show Input Fields"');
				return;
			}

			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor) {
				clearRedUnderlines(activeEditor);
			}
		}
	);
}
