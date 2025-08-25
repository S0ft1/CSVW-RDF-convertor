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
 * Adds red wavy underlines to specified lines in an editor to indicate errors.
 * @param editor - The text editor to add decorations to.
 * @param lineNumbers - Array of line numbers (0-based) to underline.
 * @param errorMessages - Optional array of error messages to display on hover.
 */
export function addRedUnderlineToLines(editor: vscode.TextEditor, lineNumbers: number[], errorMessages?: string[]) {
	const decorations: vscode.DecorationOptions[] = [];
	
	for (let i = 0; i < lineNumbers.length; i++) {
		const lineNumber = lineNumbers[i];
		if (lineNumber >= 0 && lineNumber < editor.document.lineCount) {
			const line = editor.document.lineAt(lineNumber);
			const errorMessage = errorMessages && errorMessages[i] ? errorMessages[i] : `Error on line ${lineNumber + 1}`;
			const decoration: vscode.DecorationOptions = {
				range: line.range,
				hoverMessage: errorMessage
			};
			decorations.push(decoration);
		}
	}
	
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
