// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Simple Tree Data Provider for the Activity Bar view
class CSVWActionsProvider implements vscode.TreeDataProvider<string> {
	private _onDidChangeTreeData: vscode.EventEmitter<string | undefined | null | void> = new vscode.EventEmitter<string | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<string | undefined | null | void> = this._onDidChangeTreeData.event;

	getTreeItem(element: string): vscode.TreeItem {
		const item = new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);
		
		switch (element) {
			case 'Add Conversion':
				item.command = { command: 'csvwrdfconvertor.showInputFields', title: 'Show Input Fields' };
				item.iconPath = new vscode.ThemeIcon('add');
				break;
			case 'Convert':
				item.command = { command: 'csvwrdfconvertor.convert', title: 'Convert' };
				item.iconPath = new vscode.ThemeIcon('gear');
				break;
			case 'Download Output':
				item.command = { command: 'csvwrdfconvertor.downloadOutput', title: 'Download Output' };
				item.iconPath = new vscode.ThemeIcon('cloud-download');
				break;
			case 'Convert Current Window':
				item.command = { command: 'csvwrdfconvertor.convertCurrentWindow', title: 'Convert Current Window' };
				item.iconPath = new vscode.ThemeIcon('arrow-right');
				break;
		}
		
		return item;
	}

	getChildren(element?: string): Thenable<string[]> {
		if (!element) {
			return Promise.resolve([
				'Add Conversion',
				'Convert',
				'Download Output',
				'Convert Current Window'
			]);
		}
		return Promise.resolve([]);
	}
}

// Create decoration types for red underlines with enhanced styling
const redUnderlineDecorationType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'underline wavy',
	borderWidth: '0 0 2px 0',
	borderStyle: 'solid',
	borderColor: '#ff4444',
	backgroundColor: 'rgba(255, 68, 68, 0.1)',
	overviewRulerColor: '#ff4444',
	overviewRulerLane: vscode.OverviewRulerLane.Right
});

// Function to add red underlines to specific lines with custom error messages
function addRedUnderlineToLines(editor: vscode.TextEditor, lineNumbers: number[], errorMessages?: string[]) {
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

// Function to clear red underlines
function clearRedUnderlines(editor: vscode.TextEditor) {
	editor.setDecorations(redUnderlineDecorationType, []);
}

// Function to check if input fields are open
function areInputFieldsOpen(): boolean {
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

// Track editors created by this extension
let extensionCreatedEditors: vscode.TextEditor[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Set up context for when clauses
	const updateEditorContext = (editor: vscode.TextEditor | undefined) => {
		if (editor) {
			const content = editor.document.getText();
			const fileName = editor.document.fileName || editor.document.uri.path;
			
			// Check if content looks like CSVW descriptor
			const looksLikeCsvw = 
				content.includes('@context') && content.includes('csvw') ||
				content.includes('tableSchema') ||
				content.includes('columns') ||
				content.startsWith('http') && (content.includes('.csv') || content.includes('.tsv')) ||
				fileName.toLowerCase().includes('csvw') ||
				fileName.toLowerCase().includes('descriptor');
			
			vscode.commands.executeCommand('setContext', 'csvwrdfconvertor.looksLikeCsvw', looksLikeCsvw);
		} else {
			vscode.commands.executeCommand('setContext', 'csvwrdfconvertor.looksLikeCsvw', false);
		}
	};

	// Update context when active editor changes
	vscode.window.onDidChangeActiveTextEditor(updateEditorContext);
	
	// Update context when document content changes
	vscode.workspace.onDidChangeTextDocument((event) => {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document === event.document) {
			updateEditorContext(activeEditor);
		}
	});

	// Set initial context
	updateEditorContext(vscode.window.activeTextEditor);

	// Register the tree data provider for the activity bar view
	const csvwActionsProvider = new CSVWActionsProvider();
	vscode.window.registerTreeDataProvider('csvw-rdf-actions', csvwActionsProvider);

	// Auto-validation: Listen for text changes in the Descriptor field
	const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
		const fileName = event.document.fileName || event.document.uri.path;
		
		// Only process changes in the Descriptor field
		if (fileName.includes('Descriptor')) {
			// Find the descriptor editor
			let descriptorEditor: vscode.TextEditor | undefined;
			for (const editor of vscode.window.visibleTextEditors) {
				const editorFileName = editor.document.fileName || editor.document.uri.path;
				if (editorFileName.includes('Descriptor')) {
					descriptorEditor = editor;
					break;
				}
			}

			if (descriptorEditor) {
				// Clear existing red underlines first
				clearRedUnderlines(descriptorEditor);
				
				// Get the current content
				const content = event.document.getText();
				console.log(content);
				addRedUnderlineToLines(descriptorEditor,[0, 2, 4], ["x1","x2","x3"]);
				// TODO: Add your auto-validation logic here
				// This is where you would implement real-time validation
				// For now, this is left empty for you to implement later
				
				// Example of what you could do:
				// const validationResults = validateDescriptorContent(content);
				// if (validationResults.errors.length > 0) {
				//     addRedUnderlineToLines(descriptorEditor, validationResults.lineNumbers, validationResults.errorMessages);
				// }
			}
		}
	});

	const showInputFields = vscode.commands.registerCommand(
		'csvwrdfconvertor.showInputFields',
		async () => {
			// Check if the fields are already open
			let descriptorExists = false;
			let inputExists = false;
			let outputExists = false;
			
			for (const editor of vscode.window.visibleTextEditors) {
				const fileName = editor.document.fileName || editor.document.uri.path;
				if (fileName.includes('Descriptor')) descriptorExists = true;
				if (fileName.includes('Input')) inputExists = true;
				if (fileName.includes('Output')) outputExists = true;
			}
			
			// If all three fields are already open, do nothing
			if (descriptorExists && inputExists && outputExists) {
				vscode.window.showInformationMessage('📝 Input fields are already open');
				return;
			}

			// Create new untitled documents
			const descriptorUri = vscode.Uri.parse(`untitled:Descriptor`);
			const inputUri = vscode.Uri.parse(`untitled:Input`);
			const outputUri = vscode.Uri.parse(`untitled:Output`);

			const descriptorWindow = await vscode.workspace.openTextDocument(descriptorUri);
			const inputWindow = await vscode.workspace.openTextDocument(inputUri);
			const outputWindow = await vscode.workspace.openTextDocument(outputUri);

			// Show them in ViewColumn.One, Two, and Three (splitting the editor)
			const descriptorEditor = await vscode.window.showTextDocument(descriptorWindow, vscode.ViewColumn.One);
			const inputEditor = await vscode.window.showTextDocument(inputWindow, vscode.ViewColumn.Two);
			const outputEditor = await vscode.window.showTextDocument(outputWindow, vscode.ViewColumn.Three);
			
			// Set initial content using edit operations with enhanced styling
			await descriptorEditor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(0, 0), '# JSONLD Descriptor\n# Paste your descriptor here');
			});
			await inputEditor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(0, 0), '# Input Data\n# Paste your CSV or RDF data below');
			});
			await outputEditor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(0, 0), '# Output\n# The converted data will appear here after conversion\n# This will be populated when you click the Convert button\n\nOutput will be there after conversion');
			});
			
			// Track these editors
			extensionCreatedEditors = [descriptorEditor, inputEditor, outputEditor];
		}
	);

	const openSettings = vscode.commands.registerCommand(
		'csvwrdfconvertor.convert',
		async () => {
			// Check if input fields are open first
			if (!areInputFieldsOpen()) {
				vscode.window.showWarningMessage('Please open input fields first by clicking "Show Input Fields"');
				return;
			}

			// Find the specific editors
			let descriptorEditor: vscode.TextEditor | undefined;
			let inputEditor: vscode.TextEditor | undefined;
			let outputEditor: vscode.TextEditor | undefined;

			for (const editor of vscode.window.visibleTextEditors) {
				const fileName = editor.document.fileName || editor.document.uri.path;
				if (fileName.includes('Descriptor')) descriptorEditor = editor;
				if (fileName.includes('Input')) inputEditor = editor;
				if (fileName.includes('Output')) outputEditor = editor;
			}

			if (!descriptorEditor || !inputEditor || !outputEditor) {
				vscode.window.showErrorMessage('❌ Could not find all required editors');
				return;
			}

			// Get content from editors
			const descriptorContent = descriptorEditor.document.getText();
			const inputContent = inputEditor.document.getText();

			// TODO: Add your conversion logic here
			// This is where you would implement the actual CSV to RDF conversion
			const convertedOutput = "Conversion result will be implemented here";

			// Display result in output editor
			await outputEditor.edit(editBuilder => {
				const firstLine = outputEditor.document.lineAt(0);
				const lastLine = outputEditor.document.lineAt(outputEditor.document.lineCount - 1);
				const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
				editBuilder.replace(fullRange, convertedOutput);
			});

			vscode.window.showInformationMessage('✅ Conversion completed!');
		}
	);

	// Command to clear red underlines
	const clearRedUnderlinesCommand = vscode.commands.registerCommand(
		'csvwrdfconvertor.clearRedUnderlines',
		async () => {
			// Check if input fields are open first
			if (!areInputFieldsOpen()) {
				vscode.window.showWarningMessage('Please open input fields first by clicking "Show Input Fields"');
				return;
			}

			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor) {
				clearRedUnderlines(activeEditor);
				vscode.window.showInformationMessage('🧹 Cleared red underlines');
			}
		}
	);

	// Command to download output content as file
	const downloadOutputCommand = vscode.commands.registerCommand(
		'csvwrdfconvertor.downloadOutput',
		async () => {
			// Check if input fields are open first
			if (!areInputFieldsOpen()) {
				vscode.window.showWarningMessage('Please open input fields first by clicking "Show Input Fields"');
				return;
			}

			// Find the output editor specifically
			let outputEditor: vscode.TextEditor | undefined;
			for (const editor of vscode.window.visibleTextEditors) {
				const fileName = editor.document.fileName || editor.document.uri.path;
				if (fileName.includes('Output')) {
					outputEditor = editor;
					break;
				}
			}

			if (outputEditor) {
				// Get the content from the output editor
				const content = outputEditor.document.getText();
				
				if (content.trim() === '' || content.trim() === 'Output will be there after conversion') {
					vscode.window.showWarningMessage('⚠️ Output is empty or contains only default content');
					return;
				}

				// Show input box for filename with enhanced styling
				const fileName = await vscode.window.showInputBox({
					prompt: '💾 Enter filename for your output file (without extension)',
					placeHolder: 'my_converted_data',
					title: 'Save Output File',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value || value.trim() === '') {
							return '❌ Filename cannot be empty';
						}
						// Check for invalid characters in filename
						const invalidChars = /[<>:"/\\|?*]/g;
						if (invalidChars.test(value)) {
							return '❌ Filename contains invalid characters: < > : " / \\ | ? *';
						}
						if (value.length > 100) {
							return '❌ Filename is too long (max 100 characters)';
						}
						return null;
					}
				});

				if (fileName) {
					// Show save dialog
					const saveUri = await vscode.window.showSaveDialog({
						defaultUri: vscode.Uri.file(`${fileName}.txt`),
						filters: {
							'Text files': ['txt'],
							'CSV files': ['csv'],
							'RDF files': ['rdf', 'ttl', 'n3'],
							'All files': ['*']
						}
					});

					if (saveUri) {
						try {
							// Write content to file
							const encoder = new TextEncoder();
							const data = encoder.encode(content);
							await vscode.workspace.fs.writeFile(saveUri, data);
							
							vscode.window.showInformationMessage(`💾 File saved successfully: ${saveUri.fsPath}`);
						} catch (error) {
							vscode.window.showErrorMessage(`❌ Failed to save file: ${error}`);
						}
					}
				}
			} else {
				vscode.window.showWarningMessage('Output field not found');
			}
		}
	);

	// Command to validate - clears existing red underlines and adds new ones based on validation
	const validateCommand = vscode.commands.registerCommand(
		'csvwrdfconvertor.validate',
		async () => {
			// Check if input fields are open first
			if (!areInputFieldsOpen()) {
				vscode.window.showWarningMessage('Please open input fields first by clicking "Show Input Fields"');
				return;
			}

			// Find the descriptor editor specifically
			let descriptorEditor: vscode.TextEditor | undefined;
			for (const editor of vscode.window.visibleTextEditors) {
				const fileName = editor.document.fileName || editor.document.uri.path;
				if (fileName.includes('Descriptor')) {
					descriptorEditor = editor;
					break;
				}
			}

			if (descriptorEditor) {
				// Always clear existing red underlines first
				clearRedUnderlines(descriptorEditor);
				
				// TODO: Add your validation logic here
				// Get the content to validate from the descriptor field
				const content = descriptorEditor.document.getText();
				
				// Placeholder: Add your validation logic and determine which lines have errors
				// Note: validateDescriptor function doesn't exist in the library
				// You can implement custom validation logic here
				const linesToUnderline = [0, 2, 4];
				const errorMessages = ["x1","x2","x3"];
				
				// Example validation logic (replace this with your actual validation)
				// Split content into lines and check each one
				const lines = content.split('\n');
				for (let i = 0; i < lines.length; i++) {
					// Add your validation conditions here
					// For example, if a line is empty or has specific validation errors:
					// if (lines[i].trim() === '') {
					//     linesToUnderline.push(i);
					//     errorMessages.push('Line cannot be empty');
					// }
					
					// TODO: Replace with your actual validation logic
					// Example: Add line numbers and corresponding error messages
					// linesToUnderline.push(lineNumber);
					// errorMessages.push('Your custom error message for this line');
				}
				
				// Apply red underlines to the problematic lines with custom error messages
				if (linesToUnderline.length > 0) {
					addRedUnderlineToLines(descriptorEditor, linesToUnderline, errorMessages);
					vscode.window.showInformationMessage(`🔍 Validation complete. Found ${linesToUnderline.length} error(s) on lines: ${linesToUnderline.map(l => l + 1).join(', ')}`);
				} else {
					vscode.window.showInformationMessage('✅ Validation complete. No errors found!');
				}
			} else {
				vscode.window.showWarningMessage('Descriptor field not found');
			}
		}
	);

	// Command to convert current window content as CSVW descriptor
	const convertCurrentWindowCommand = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertCurrentWindow',
		async () => {
			const activeEditor = vscode.window.activeTextEditor;
			
			if (!activeEditor) {
				vscode.window.showWarningMessage('⚠️ No active editor found. Please open a file with CSVW descriptor content.');
				return;
			}

			// Get content from the active editor
			const descriptorContent = activeEditor.document.getText().trim();
			
			if (!descriptorContent) {
				vscode.window.showWarningMessage('⚠️ Active editor is empty. Please add CSVW descriptor content.');
				return;
			}

			try {
				let convertedOutput: string;
				let parsedDescriptor: CsvwDescriptor;

				try {
					// Try to parse the content as JSON (CSVW descriptor)
					parsedDescriptor = JSON.parse(descriptorContent);

					convertedOutput = "TODO: implement conversion logic"

				} catch (parseError) {
					// If JSON parsing fails, treat it as a CSV URL or try other formats
					
					// Check if content looks like a URL
					if (descriptorContent.startsWith('http') || descriptorContent.startsWith('file://')) {
						// For now, just placeholder - actual stream handling would be needed
						convertedOutput = "RDF conversion from URL - implementation needed";
					} else {
						const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
						throw new Error(`Failed to parse as CSVW descriptor: ${errorMsg}\n\nContent should be:\n1. Valid JSON CSVW descriptor, or\n2. URL to CSV file`);
					}
				}

				// Create a new untitled document for the output
				const outputUri = vscode.Uri.parse(`untitled:Converted-RDF-${Date.now()}`);
				const outputDocument = await vscode.workspace.openTextDocument(outputUri);
				const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Beside);

				// Insert the converted content
				await outputEditor.edit(editBuilder => {
					editBuilder.insert(new vscode.Position(0, 0), 
						`# Converted RDF Output\n# Original source: ${activeEditor.document.fileName || 'Untitled'}\n# Conversion timestamp: ${new Date().toISOString()}\n\n${convertedOutput}`
					);
				});

				vscode.window.showInformationMessage('✅ CSVW descriptor converted successfully! Output opened in new window.');

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
				vscode.window.showErrorMessage(`❌ Conversion failed: ${errorMessage}`);
				console.error('CSVW Conversion Error:', error);
			}
		}
	);

	// Register all commands with the extension context
	context.subscriptions.push(
		showInputFields, 
		openSettings, 
		downloadOutputCommand,
		changeListener,
		convertCurrentWindowCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() { 
	// Clear the tracking array
	extensionCreatedEditors = [];
}
