import * as vscode from 'vscode';

/**
 * Decoration type for displaying red wavy underlines in the editor.
 * Used to highlight errors and validation issues.
 */
const redUnderlineDecorationType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'underline wavy',
	borderWidth: '0 0 2px 0',
	borderStyle: 'solid',
	borderColor: '#ff4444',
	backgroundColor: 'rgba(255, 68, 68, 0.1)',
	overviewRulerColor: '#ff4444',
	overviewRulerLane: vscode.OverviewRulerLane.Right
});

/**
 * Adds red wavy underlines to the first line in an editor to indicate errors.
 * Shows all error messages on the first line.
 * @param editor - The text editor to add decorations to.
 * @param errorMessages - Array of error messages to display on hover.
 */
export function addRedUnderlineToLines(editor: vscode.TextEditor, errorMessages: string[]) {
	const decorations: vscode.DecorationOptions[] = [];
	
	if (errorMessages.length === 0 || editor.document.lineCount === 0) {
		return;
	}
	const firstLine = editor.document.lineAt(0);

	let combinedErrorMessage = 'Validation Errors/Warnings:\n';
	const cleanedMessages = errorMessages.map(msg => {
		const cleanMsg = String(msg).trim();
		return cleanMsg.endsWith('}') ? cleanMsg.slice(0, -1).trim() : cleanMsg;
	});
	combinedErrorMessage += cleanedMessages.map(msg => `\n• ${msg}`).join('\n');
	const decoration: vscode.DecorationOptions = {
		range: firstLine.range,
		hoverMessage: combinedErrorMessage
	};
	
	decorations.push(decoration);
	editor.setDecorations(redUnderlineDecorationType, decorations);
}

/**
 * Clears all red underline decorations from an editor.
 * @param editor - The text editor to clear decorations from.
 */
export function clearRedUnderlines(editor: vscode.TextEditor) {
	editor.setDecorations(redUnderlineDecorationType, []);
}

/**
 * Checks if all required input fields (descriptor, input, output) are currently open in the editor.
 * @returns True if all three required editors are open, false otherwise.
 */
export function areInputFieldsOpen(): boolean {
	let descriptorExists = false;
	let inputExists = false;
	let outputExists = false;
	
	for (const editor of vscode.window.visibleTextEditors) {
		const fileName = editor.document.fileName || editor.document.uri.path;
		if (fileName.includes('Descriptor')) descriptorExists = true;
		if (fileName.includes('Input')) inputExists = true;
		if (fileName.includes('Output')) outputExists = true;
	}
	
	return descriptorExists && inputExists && outputExists;
}
