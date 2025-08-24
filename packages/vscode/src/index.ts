// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { csvUrlToRdf, csvwDescriptorToRdf, CsvwTablesStream, defaultResolveJsonldFn, defaultResolveStreamFn, defaultResolveTextFn, Rdf2CsvOptions, Rdf2CsvwConvertor, rdfStreamToArray, validateCsvwFromDescriptor } from '@csvw-rdf-convertor/core'
import { Csvw2RdfOptions } from '@csvw-rdf-convertor/core'
import { Readable } from 'node:stream';
import fs from 'node:fs';
import TurtleSerializer from '@rdfjs/serializer-turtle';
import * as csv from 'csv';

interface MiniOptions {
  templateIris?: boolean;
  minimal?: boolean;
}

// Interface for conversion items
interface ConversionItem {
	id: string;
	name: string;
	folderPath?: string;
	descriptorEditor?: vscode.TextEditor;
	inputEditor?: vscode.TextEditor;
	outputEditor?: vscode.TextEditor;
	descriptorFilePath?: string;
	inputFilePath?: string;
	outputFilePath?: string;
	additionalInputFilePaths?: string[]; // Track all additional input file paths
	templateIRIsChecked?: boolean; // Checkbox state for template IRIs
	minimalModeChecked?: boolean; // Checkbox state for minimal mode
}

// Tree item types
type TreeItem = string | ConversionItem;

// Simple Tree Data Provider for the Activity Bar view
class CSVWActionsProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private conversions: ConversionItem[] = [];
	public conversionCounter = 1;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	addConversion(name?: string): ConversionItem {
		const conversionName = name || `Conversion ${this.conversionCounter}`;
		const conversion: ConversionItem = {
			id: `conversion-${this.conversionCounter}`,
			name: conversionName
		};
		this.conversions.push(conversion);
		this.conversionCounter++;
		this.refresh();
		return conversion;
	}

	removeConversion(id: string): void {
		this.conversions = this.conversions.filter(c => c.id !== id);
		this.refresh();
	}

	getConversion(id: string): ConversionItem | undefined {
		return this.conversions.find(c => c.id === id);
	}

	getTreeItem(element: TreeItem): vscode.TreeItem {
		if (typeof element === 'string') {
			if (element.includes(':')) {
				// Conversion action item
				return this.createActionTreeItem(element);
			} else {
				// Top-level actions
				const item = new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);

				switch (element) {
					case 'Add Conversion':
						item.command = { command: 'csvwrdfconvertor.addNewConversion', title: 'Add New Conversion' };
						item.iconPath = new vscode.ThemeIcon('add');
						break;
					case 'Convert Current Window':
						item.command = { command: 'csvwrdfconvertor.convertCurrentWindow', title: 'Convert Current Window' };
						item.iconPath = new vscode.ThemeIcon('arrow-right');
						break;
				}

				return item;
			}
		} else {
			// Conversion group
			const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
			item.iconPath = new vscode.ThemeIcon('folder');
			item.contextValue = 'conversion';
			item.id = element.id;
			return item;
		}
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (!element) {
			// Root level - show main actions and conversions
			const mainActions = ['Add Conversion', 'Convert Current Window'];
			return Promise.resolve([...mainActions, ...this.conversions]);
		} else if (typeof element !== 'string') {
			// Conversion group - show its actions
			const conversionActions = [
				`${element.id}:Open Fields`,
				`${element.id}:Close Fields`,
				`${element.id}:Convert`,
				`${element.id}:Add another input`,
				`${element.id}:Validate`,
				`${element.id}:Template IRIs`,
				`${element.id}:Minimal Mode`
			];
			return Promise.resolve(conversionActions);
		}
		return Promise.resolve([]);
	}

	getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
		if (typeof element === 'string' && element.includes(':')) {
			const conversionId = element.split(':')[0];
			return this.getConversion(conversionId);
		}
		return null;
	}

	// Helper method to create tree items for conversion actions
	createActionTreeItem(action: string): vscode.TreeItem {
		const [conversionId, actionName] = action.split(':');
		const item = new vscode.TreeItem(actionName, vscode.TreeItemCollapsibleState.None);

		switch (actionName) {
			case 'Open Fields':
				item.command = { command: 'csvwrdfconvertor.openConversionFields', title: 'Open Fields', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('split-horizontal');
				break;
			case 'Close Fields':
				item.command = { command: 'csvwrdfconvertor.closeConversionFields', title: 'Close Fields', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('close-all');
				break;
			case 'Convert':
				item.command = { command: 'csvwrdfconvertor.convertSpecific', title: 'Convert', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('gear');
				break;
			case 'Add another input':
				item.command = { command: 'csvwrdfconvertor.addAnotherInput', title: 'Add another input', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('add');
				break;
			case 'Validate':
				item.command = { command: 'csvwrdfconvertor.validateSpecific', title: 'Validate', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('check');
				break;
			case 'Template IRIs':
				const conversion = this.getConversion(conversionId);
				const templateIRIsChecked = conversion?.templateIRIsChecked ?? false;
				item.command = { command: 'csvwrdfconvertor.toggleTemplateIRIs', title: 'Toggle Template IRIs', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon(
					templateIRIsChecked ? 'pass-filled' : 'circle-large-outline',
					templateIRIsChecked ? new vscode.ThemeColor('testing.iconPassed') : new vscode.ThemeColor('testing.iconQueued')
				);
				item.label = `Template IRIs`;
				item.tooltip = templateIRIsChecked ? 'Template IRIs enabled - Click to disable' : 'Template IRIs disabled - Click to enable';
				break;
			case 'Minimal Mode':
				const conv = this.getConversion(conversionId);
				const minimalModeChecked = conv?.minimalModeChecked ?? false;
				item.command = { command: 'csvwrdfconvertor.toggleMinimalMode', title: 'Toggle Minimal Mode', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon(
					minimalModeChecked ? 'pass-filled' : 'circle-large-outline',
					minimalModeChecked ? new vscode.ThemeColor('testing.iconPassed') : new vscode.ThemeColor('testing.iconQueued')
				);
				item.label = `Minimal Mode`;
				item.tooltip = minimalModeChecked ? 'Minimal Mode enabled - Click to disable' : 'Minimal Mode disabled - Click to enable';
				break;
		}

		return item;
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

// Function to load existing conversions from file system
async function loadExistingConversions(provider: CSVWActionsProvider) {
	// Check if we have a workspace folder
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		return; // No workspace, nothing to load
	}

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');

	try {
		// Check if the extension directory exists
		await vscode.workspace.fs.stat(extensionDir);

		// Read all directories in the extension folder
		const entries = await vscode.workspace.fs.readDirectory(extensionDir);

		for (const [name, type] of entries) {
			if (type === vscode.FileType.Directory) {
				// This is a conversion directory
				const conversionDir = vscode.Uri.joinPath(extensionDir, name);

				// Create conversion object
				const conversion = provider.addConversion(name);
				conversion.folderPath = conversionDir.fsPath;

				// Define expected file paths
				const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
				const inputPath = vscode.Uri.joinPath(conversionDir, 'input.csv');
				const outputPath = vscode.Uri.joinPath(conversionDir, 'output.ttl');

				conversion.descriptorFilePath = descriptorPath.fsPath;
				conversion.inputFilePath = inputPath.fsPath;
				conversion.outputFilePath = outputPath.fsPath;

				// Check and create missing files
				await ensureFileExists(descriptorPath, getDefaultDescriptorContent());
				await ensureFileExists(inputPath, getDefaultInputContent(name));
				await ensureFileExists(outputPath, getDefaultOutputContent(name));
			}
		}

		// Refresh the tree view to show loaded conversions
		provider.refresh();

		if (entries.length > 0) {
			vscode.window.showInformationMessage(`📁 Loaded ${entries.filter(([, type]) => type === vscode.FileType.Directory).length} existing conversion(s)`);
		}

	} catch (error) {
		// Extension directory doesn't exist yet, which is fine
		console.log('No existing conversions found');
	}
}

// Helper function to ensure a file exists with default content
async function ensureFileExists(filePath: vscode.Uri, defaultContent: string) {
	try {
		await vscode.workspace.fs.stat(filePath);
		// File exists, do nothing
	} catch {
		// File doesn't exist, create it
		const encoder = new TextEncoder();
		await vscode.workspace.fs.writeFile(filePath, encoder.encode(defaultContent));
	}
}

// Helper functions to get default content for each file type
function getDefaultDescriptorContent(): string {
	return `{
  "@context": "http://www.w3.org/ns/csvw",
  "@type": "TableGroup",
  "tables": [{
    "url": "input.csv",
    "tableSchema": {
      "columns": []
    }
  }]
}`;
}

function getDefaultInputContent(conversionName: string): string {
	return `# Input Data for ${conversionName}
# Paste your CSV data below or replace this file with your CSV

id,name,value
1,"Sample 1",100
2,"Sample 2",200`;
}

function getDefaultOutputContent(conversionName: string): string {
	return `# Output for ${conversionName}
# The converted RDF data will appear here after conversion

`;
}

// Function to convert RDF to CSVW
async function convertRDF2CSVW(descriptorText: string, inputPath: string, descriptorPath: string,conversion:any): Promise<string> {
const options: Rdf2CsvOptions = {
      baseIri: conversion.folderPath,
      resolveJsonldFn: async (path, base) => {
        const url =
          URL.parse(path, base)?.href ??
          URL.parse(path)?.href ??
          resolve(base, path);
        if (!isAbsolute(url) && URL.canParse(url)) {
          if (url.startsWith('file:')) {
            return readFile(fileURLToPath(url), 'utf-8');
          }
          return defaultResolveJsonldFn(url, base);
        }

        return await readFile(url, 'utf-8');
      },
      resolveRdfStreamFn: (path, base) => {
        const url =
          URL.parse(path, base)?.href ??
          URL.parse(path)?.href ??
          resolve(base, path);
        if (
          !isAbsolute(url) &&
          (URL.canParse(url) || URL.canParse(url, base))
        ) {
          if (url.startsWith('file:')) {
            return Promise.resolve(
              Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8'))
            );
          }
          return defaultResolveStreamFn(url, base);
        }
        return Promise.resolve(
          Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8'))
        );
      },
    };
	const convertor = new Rdf2CsvwConvertor(options);
	let streams: CsvwTablesStream;
	let descriptor: string = '';
	if (descriptorPath) {
		descriptor = (await options.resolveJsonldFn?.(descriptorPath, '')) ?? '';
	}
	if (descriptorPath === "") {
		streams = await convertor.convert(inputPath);
	} else {
		streams = await convertor.convert(inputPath, descriptor);
	}
	let outputText: string = '';

	for (const [tableName, [columns, stream]] of Object.entries(streams)) {
		const descriptorObj = convertor.getDescriptor();
		const normalizedDescriptor = descriptorObj?.descriptor ?? {};
		const dialect = normalizedDescriptor.dialect ?? {};
		const descriptorOptions = {
			header: dialect.header ?? true,
			columns: columns.map((column) => ({
				key: column.queryVariable,
				header: column.title,
			})),
			...(dialect.delimiter !== undefined && { delimiter: dialect.delimiter }),
			...(dialect.doubleQuote !== undefined && { escape: dialect.doubleQuote ? '"' : '\\' }),
			...((dialect.quoteChar !== undefined && dialect.quoteChar !== null) && { quote: dialect.quoteChar }),

		};
		const stringifier = csv.stringify(descriptorOptions);
		stringifier.pipe(process.stdout);
		console.log("pred for awaitem")
		console.log("stream: " + stream)
		for await (const bindings of stream) {
			console.log("v for awaitu")
			const row = {} as { [key: string]: string };
			for (const [key, value] of bindings) {
				row[key.value] = value.value;
			}
			console.log(`Row: ${row}`);
			stringifier.write(row);
		}
	}
	return outputText;
}

// Function to convert CSVW to RDF
async function convertCSVW2RDF(descriptorText: string, options: MiniOptions,conversion:any): Promise<string> {
	const getUrl = (path: string, base: string) => URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
	let opts: Csvw2RdfOptions = {
		templateIris: options.templateIris,
		minimal: options.minimal,
		baseIri: conversion.folderPath,
		resolveJsonldFn: async (path, base) => {
			const url = getUrl(path, base);
			if (!isAbsolute(url) && URL.canParse(url)) {
				if (url.startsWith('file:')) {
					return readFile(fileURLToPath(url), 'utf-8');
				}
				return defaultResolveJsonldFn(url, base);
			}
			return await readFile(url, 'utf-8');
		},
		resolveWkfFn: async (path, base) => {
			const url = getUrl(path, base);
			if (!isAbsolute(url) && URL.canParse(url)) {
				if (url.startsWith('file:')) {
					return readFile(fileURLToPath(url), 'utf-8');
				}
				return defaultResolveTextFn(url, base);
			}
			return await readFile(url, 'utf-8');
		},
		resolveCsvStreamFn: (path, base) => {
			const url = getUrl(path, base);
			if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
				if (url.startsWith('file:')) {
					return Promise.resolve(
						Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8')),
					);
				}
				return defaultResolveStreamFn(url, base);
			}
			return Promise.resolve(
				Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8')),
			);
		}
	};
	try {
		const rdfStream = csvwDescriptorToRdf(descriptorText, opts);
		const quads = await rdfStreamToArray(rdfStream);
		const writer = new TurtleSerializer();
		return writer.transform(quads);
	} catch (error) {
		console.error('Error in CSV to RDF conversion:', error);
		return `Error in CSV to RDF conversion: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

async function handleConversion(descriptorText: string, inputText: string, templateIRIs: boolean = false, minimalMode: boolean = false, conversion: any): Promise<string> {
	// Create ConversionOptions object from the boolean parameters
	
	const detection = isRdfContent(inputText);

	if (!detection.isRecognized) {
		vscode.window.showWarningMessage('⚠️ Warning: Input content format could not be recognized as either RDF or CSV. Please verify your input data format.');
	}
	let opts: MiniOptions = {
		templateIris: templateIRIs,
		minimal: minimalMode
	};
	const isRdf = detection.isRdf;
	let outputText: string;
	if (isRdf) {
		outputText = await convertRDF2CSVW(descriptorText, conversion.inputFilePath,conversion.descriptorFilePath,conversion);
	} else {
		outputText = await convertCSVW2RDF(descriptorText, opts,conversion);
	}
	return outputText;
}
// Function to detect if input content is RDF or CSV
function isRdfContent(inputText: string): { isRdf: boolean, isRecognized: boolean } {
	const trimmedContent = inputText.trim().toLowerCase();

	// Turtle/N3 format indicators
	if (trimmedContent.includes('@prefix') ||
		trimmedContent.includes('@base') ||
		trimmedContent.includes('a ') ||
		trimmedContent.match(/<[^>]*>\s+<[^>]*>\s+<[^>]*>/)) {
		return { isRdf: true, isRecognized: true };
	}

	// RDF/XML format indicators
	if (trimmedContent.includes('<rdf:') ||
		trimmedContent.includes('xmlns:rdf') ||
		trimmedContent.includes('rdf:about') ||
		trimmedContent.includes('rdf:resource')) {
		return { isRdf: true, isRecognized: true };
	}

	// N-Triples format indicators (subject predicate object .)
	if (trimmedContent.match(/<[^>]*>\s+<[^>]*>\s+[^.]*\s*\./)) {
		return { isRdf: true, isRecognized: true };
	}

	// JSON-LD format indicators
	try {
		const parsed = JSON.parse(inputText);
		if (parsed['@context'] || parsed['@graph'] || parsed['@id'] || parsed['@type']) {
			return { isRdf: true, isRecognized: true };
		}
	} catch {
		// Not valid JSON, continue with other checks
	}

	// CSV format indicators - check for common CSV patterns
	const lines = inputText.split('\n').filter(line => line.trim().length > 0);
	if (lines.length > 0) {
		const firstLine = lines[0];
		// Check if it looks like CSV headers (comma-separated values without RDF syntax)
		if (firstLine.includes(',') &&
			!firstLine.includes('<') &&
			!firstLine.includes('@') &&
			!firstLine.includes('xmlns')) {
			return { isRdf: false, isRecognized: true };
		}

		// Check for other CSV-like patterns (tab-separated, semicolon-separated)
		if ((firstLine.includes('\t') || firstLine.includes(';')) &&
			!firstLine.includes('<') &&
			!firstLine.includes('@')) {
			return { isRdf: false, isRecognized: true };
		}
	}

	// If we can't definitively identify the format
	return { isRdf: false, isRecognized: false };
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
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

	// Load existing conversions from file system on startup
	await loadExistingConversions(csvwActionsProvider);

	// Helper function to find conversion by file path
	function findConversionByFilePath(filePath: string): ConversionItem | undefined {
		for (const conversion of (csvwActionsProvider as any).conversions) {
			// Check if the file path matches any of the conversion's file paths
			if (conversion.descriptorFilePath && filePath === conversion.descriptorFilePath) {
				return conversion;
			}
			if (conversion.inputFilePath && filePath === conversion.inputFilePath) {
				return conversion;
			}
			if (conversion.outputFilePath && filePath === conversion.outputFilePath) {
				return conversion;
			}
			// Check additional input file paths
			if (conversion.additionalInputFilePaths) {
				for (const additionalPath of conversion.additionalInputFilePaths) {
					if (filePath === additionalPath) {
						return conversion;
					}
				}
			}
		}
		return undefined;
	}

	// Auto-validation and conversion: Listen for text changes in the Descriptor and Input fields
	const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
		const fileName = event.document.fileName || event.document.uri.path;
		const changedDocument = event.document;

		// Process changes in Descriptor or Input fields - make case insensitive
		const lowerFileName = fileName.toLowerCase();
		if (lowerFileName.includes('descriptor') || lowerFileName.includes('input')) {

			// Get content directly from the changed document
			const changedContent = changedDocument.getText();

			// Find the editor for the changed document
			const changedEditor = vscode.window.visibleTextEditors.find(
				editor => editor.document === changedDocument
			);

			if (lowerFileName.includes('descriptor')) {
				// Handle descriptor changes
				if (changedEditor) {
					async (conversionId: string) => {
						const conversion = csvwActionsProvider.getConversion(conversionId);
						validateDocument(conversion);
					}
				}

				// Try to perform auto-conversion if we can find a corresponding input file
				const correspondingInputPath = fileName.replace(/descriptor\.jsonld/i, 'input.csv');
				try {
					const inputDoc = await vscode.workspace.openTextDocument(correspondingInputPath);
					const inputContent = inputDoc.getText();

					// Find the conversion object to get actual checkbox values
					const conversion = findConversionByFilePath(fileName);
					const templateIRIs = conversion?.templateIRIsChecked || false;
					const minimalMode = conversion?.minimalModeChecked || false;

					// Call conversion with actual options from the conversion object
					const result = await handleConversion(changedContent, inputContent, templateIRIs, minimalMode, conversion);

					// Try to update output file
					const outputPath = fileName.replace(/descriptor\.jsonld/i, 'output.ttl');
					try {
						const outputDoc = await vscode.workspace.openTextDocument(outputPath);
						const outputEditor = vscode.window.visibleTextEditors.find(
							editor => editor.document === outputDoc
						);
						if (outputEditor) {
							await outputEditor.edit(editBuilder => {
								const fullRange = new vscode.Range(
									outputDoc.lineAt(0).range.start,
									outputDoc.lineAt(outputDoc.lineCount - 1).range.end
								);
								editBuilder.replace(fullRange, result);
							});
						}
					} catch {
						// Output file not found or not accessible
						console.log('Could not update output file');
					}
				} catch {
					// Input file not found or not accessible
					console.log('Could not find corresponding input file for auto-conversion');
				}

			} else if (lowerFileName.includes('input')) {

				// Handle input changes
				console.log('Input changed:', changedContent);

				// Try to perform auto-conversion if we can find a corresponding descriptor file
				const correspondingDescriptorPath = fileName.replace(/input\d*\.csv/i, 'descriptor.jsonld');
				try {
					const descriptorDoc = await vscode.workspace.openTextDocument(correspondingDescriptorPath);
					const descriptorContent = descriptorDoc.getText();

					// Find the conversion object to get actual checkbox values
					const conversion = findConversionByFilePath(fileName);
					const templateIRIs = conversion?.templateIRIsChecked || false;
					const minimalMode = conversion?.minimalModeChecked || false;

					// Call conversion with actual options from the conversion object
					const result = await handleConversion(descriptorContent, changedContent, templateIRIs, minimalMode, conversion);

					// Try to update output file
					const outputPath = correspondingDescriptorPath.replace(/descriptor\.jsonld/i, 'output.ttl');
					try {
						const outputDoc = await vscode.workspace.openTextDocument(outputPath);
						const outputEditor = vscode.window.visibleTextEditors.find(
							editor => editor.document === outputDoc
						);
						if (outputEditor) {
							await outputEditor.edit(editBuilder => {
								const fullRange = new vscode.Range(
									outputDoc.lineAt(0).range.start,
									outputDoc.lineAt(outputDoc.lineCount - 1).range.end
								);
								editBuilder.replace(fullRange, result);
							});
						}
					} catch {
						// Output file not found or not accessible
						console.log('Could not update output file');
					}
				} catch {
					// Descriptor file not found or not accessible
					console.log('Could not find corresponding descriptor file for auto-conversion');
				}
			}
		}
	});

	// Command to add a new conversion
	const addNewConversion = vscode.commands.registerCommand(
		'csvwrdfconvertor.addNewConversion',
		async () => {
			// Ask user for conversion name
			const conversionName = await vscode.window.showInputBox({
				prompt: '📝 Enter a name for this conversion',
				placeHolder: `Conversion ${csvwActionsProvider.conversionCounter}`,
				title: 'New Conversion',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (value && value.length > 50) {
						return '❌ Name is too long (max 50 characters)';
					}
					return null;
				}
			});

			// Create new conversion
			const conversion = csvwActionsProvider.addConversion(conversionName);

			// Automatically open fields for the new conversion
			await openFieldsForConversion(conversion);

			vscode.window.showInformationMessage(`✅ Created conversion: ${conversion.name} with fields opened`);
		}
	);

	// Helper function to open fields for a conversion
	async function openFieldsForConversion(conversion: ConversionItem) {
		// Check if we have a workspace folder
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('❌ No workspace folder open. Please open a folder first.');
			return;
		}

		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');
		const conversionDir = vscode.Uri.joinPath(extensionDir, conversion.name.replace(/[<>:"/\\|?*]/g, '_'));

		// Create directories if they don't exist
		try {
			await vscode.workspace.fs.createDirectory(extensionDir);
			await vscode.workspace.fs.createDirectory(conversionDir);
		} catch (error) {
			// Directories might already exist, which is fine
		}

		// Define file paths
		const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
		const inputPath = vscode.Uri.joinPath(conversionDir, 'input.csv');
		const outputPath = vscode.Uri.joinPath(conversionDir, 'output.ttl');

		// Store file paths in conversion
		conversion.folderPath = conversionDir.fsPath;
		conversion.descriptorFilePath = descriptorPath.fsPath;
		conversion.inputFilePath = inputPath.fsPath;
		conversion.outputFilePath = outputPath.fsPath;

		// Create files with initial content if they don't exist
		const encoder = new TextEncoder();

		try {
			await vscode.workspace.fs.stat(descriptorPath);
		} catch {
			// File doesn't exist, create it
			const descriptorContent = `{
  "@context": "http://www.w3.org/ns/csvw",
  "@type": "TableGroup",
  "tables": [{
    "url": "file://input.csv",
    "tableSchema": {
      "columns": []
    }
  }]
}`;
			await vscode.workspace.fs.writeFile(descriptorPath, encoder.encode(descriptorContent));
		}

		try {
			await vscode.workspace.fs.stat(inputPath);
		} catch {
			// File doesn't exist, create it
			const inputContent = `# Input Data for ${conversion.name}
# Paste your CSV data below or replace this file with your CSV

id,name,value
1,"Sample 1",100
2,"Sample 2",200`;
			await vscode.workspace.fs.writeFile(inputPath, encoder.encode(inputContent));
		}

		try {
			await vscode.workspace.fs.stat(outputPath);
		} catch {
			// File doesn't exist, create it
			const outputContent = `# Output for ${conversion.name}
# The converted RDF data will appear here after conversion

`;
			await vscode.workspace.fs.writeFile(outputPath, encoder.encode(outputContent));
		}

		// Open the files in the editor
		const descriptorDocument = await vscode.workspace.openTextDocument(descriptorPath);
		const inputDocument = await vscode.workspace.openTextDocument(inputPath);
		const outputDocument = await vscode.workspace.openTextDocument(outputPath);

		// Show them in ViewColumn.One, Two, and Three (splitting the editor)
		const descriptorEditor = await vscode.window.showTextDocument(descriptorDocument, vscode.ViewColumn.One);
		const inputEditor = await vscode.window.showTextDocument(inputDocument, vscode.ViewColumn.Two);
		const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);

		// Store references in the conversion
		conversion.descriptorEditor = descriptorEditor;
		conversion.inputEditor = inputEditor;
		conversion.outputEditor = outputEditor;

		// Initialize additional input files tracking
		conversion.additionalInputFilePaths = [];

		// Open additional input files if they exist - create tabs in column 2
		try {
			const entries = await vscode.workspace.fs.readDirectory(conversionDir);

			for (const [fileName, fileType] of entries) {
				if (fileType === vscode.FileType.File && fileName.match(/^input\d+\.csv$/)) {
					const additionalInputPath = vscode.Uri.joinPath(conversionDir, fileName);
					try {
						const additionalInputDocument = await vscode.workspace.openTextDocument(additionalInputPath);
						// Open each additional input as a tab in column 2, preserving focus on main input
						await vscode.window.showTextDocument(additionalInputDocument, {
							viewColumn: vscode.ViewColumn.Two,
							preserveFocus: true,
							preview: false // Without this the new tab would close the previous tab
						});

						// Track this additional input file path
						conversion.additionalInputFilePaths.push(additionalInputPath.fsPath);
					} catch (error) {
						console.log(`Could not open additional input file ${fileName}:`, error);
					}
				}
			}
		} catch (error) {
			// Directory scanning failed, but that's okay - main files are still open
			console.log('Could not scan for additional input files:', error);
		}
	}

	// Command to open fields for a specific conversion (only if they were closed)
	const openConversionFields = vscode.commands.registerCommand(
		'csvwrdfconvertor.openConversionFields',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			// Check if the files exist and are currently open in editors
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
				allFilesOpen = descriptorOpen && inputOpen && outputOpen;
			}

			if (allFilesOpen) {
				vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already open`);
				return;
			}

			// Open the fields
			await openFieldsForConversion(conversion);
			vscode.window.showInformationMessage(`✅ Opened fields for conversion: ${conversion.name}`);
		}
	);

	// Command to close fields for a specific conversion
	const closeConversionFields = vscode.commands.registerCommand(
		'csvwrdfconvertor.closeConversionFields',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			// Check if any files are open for this conversion
			const pathsToClose: string[] = [];

			// Add descriptor file path
			if (conversion.descriptorFilePath) {
				pathsToClose.push(conversion.descriptorFilePath);
			}

			// Add main input file path
			if (conversion.inputFilePath) {
				pathsToClose.push(conversion.inputFilePath);
			}

			// Add all tracked additional input file paths
			if (conversion.additionalInputFilePaths) {
				pathsToClose.push(...conversion.additionalInputFilePaths);
			}

			// Add output file path
			if (conversion.outputFilePath) {
				pathsToClose.push(conversion.outputFilePath);
			}

			if (pathsToClose.length === 0) {
				vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already closed`);
				return;
			}

			// Close all tabs for this conversion using Tab Groups API
			const tabsToClose: vscode.Tab[] = [];

			// Go through all tab groups and collect matching tabs
			for (const tabGroup of vscode.window.tabGroups.all) {
				for (const tab of tabGroup.tabs) {
					if (tab.input instanceof vscode.TabInputText) {
						if (pathsToClose.includes(tab.input.uri.fsPath)) {
							tabsToClose.push(tab);
						}
					}
				}
			}

			// Close all collected tabs at once
			if (tabsToClose.length > 0) {
				await vscode.window.tabGroups.close(tabsToClose);
			}

			// Clear the editor references and additional input tracking
			conversion.descriptorEditor = undefined;
			conversion.inputEditor = undefined;
			conversion.outputEditor = undefined;
			conversion.additionalInputFilePaths = [];

			const fileCount = pathsToClose.length;
			const fileText = fileCount === 1 ? 'file' : 'files';
			vscode.window.showInformationMessage(`✅ Closed ${fileCount} ${fileText} for conversion: ${conversion.name}`);
		}
	);

	// Command to convert a specific conversion
	const convertSpecific = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertSpecific',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			if (!conversion.descriptorFilePath || !conversion.inputFilePath || !conversion.outputFilePath) {
				vscode.window.showWarningMessage(`Please open fields for "${conversion.name}" first`);
				return;
			}

			try {
				const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);
				const inputUri = vscode.Uri.file(conversion.inputFilePath);
				const outputUri = vscode.Uri.file(conversion.outputFilePath);

				const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
				const inputBytes = await vscode.workspace.fs.readFile(inputUri);
				const decoder = new TextDecoder();
				const descriptorContent = decoder.decode(descriptorBytes);
				const inputContent = decoder.decode(inputBytes);

				const templateIRIs = conversion.templateIRIsChecked || false;
				const minimalMode = conversion.minimalModeChecked || false;

				const convertedOutput = await handleConversion(descriptorContent, inputContent, templateIRIs, minimalMode, conversion);

				const encoder = new TextEncoder();
				await vscode.workspace.fs.writeFile(outputUri, encoder.encode(convertedOutput));

				const outputEditor = vscode.window.visibleTextEditors.find(
					editor => editor.document.uri.fsPath === conversion.outputFilePath
				);
				if (outputEditor) {
					await vscode.commands.executeCommand('workbench.action.files.revert', outputUri);
				}

				vscode.window.showInformationMessage(`✅ Conversion completed for: ${conversion.name}`);
			} catch (error) {
				vscode.window.showErrorMessage(`❌ Conversion failed: ${error}`);
			}
		}
	);

	async function validateDocument(conversion: ConversionItem | any) {
		const descriptorEditor = vscode.window.visibleTextEditors.find(
			editor => editor.document.uri.fsPath === conversion.descriptorFilePath
		);

		if (!descriptorEditor) {
			vscode.window.showWarningMessage(`Please open the descriptor file for "${conversion.name}" first`);
			return;
		}

		clearRedUnderlines(descriptorEditor);
		const content = descriptorEditor.document.getText();
		const templateIRIs = conversion.templateIRIsChecked || false;
		const minimalMode = conversion.minimalModeChecked || false;
		const getUrl = (path: string, base: string) => URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
		let opts: Csvw2RdfOptions = {
			templateIris: templateIRIs,
			minimal: minimalMode,
			baseIri: conversion.folderPath,
			resolveJsonldFn: async (path, base) => {
				const url = getUrl(path, base);
				if (!isAbsolute(url) && URL.canParse(url)) {
					if (url.startsWith('file:')) {
						return readFile(fileURLToPath(url), 'utf-8');
					}
					return defaultResolveJsonldFn(url, base);
				}
				return await readFile(url, 'utf-8');
			},
			resolveWkfFn: async (path, base) => {
				const url = getUrl(path, base);
				if (!isAbsolute(url) && URL.canParse(url)) {
					if (url.startsWith('file:')) {
						return readFile(fileURLToPath(url), 'utf-8');
					}
					return defaultResolveTextFn(url, base);
				}
				return await readFile(url, 'utf-8');
			},
			resolveCsvStreamFn: (path, base) => {
				const url = getUrl(path, base);
				if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
					if (url.startsWith('file:')) {
						return Promise.resolve(
							Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8')),
						);
					}
					return defaultResolveStreamFn(url, base);
				}
				return Promise.resolve(
					Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8')),
				);
			}
		};
		let validationResult = validateCsvwFromDescriptor(content, opts);
		console.log("po validaci")
		const messages: string[] = [];
		const locations: number[] = [];

		for await (const issue of validationResult) {
			const messageWithType = `[${issue.type.toUpperCase()}] ${issue.message}`;
			messages.push(messageWithType);
			const lineNumber = issue.location?.row ? issue.location.row - 1 : 0;
			locations.push(lineNumber);
		}
		if (messages.length > 0) {
			addRedUnderlineToLines(descriptorEditor, locations, messages);
			vscode.window.showInformationMessage(`🔍 Validation complete for "${conversion.name}". Found ${messages.length} issue(s) on lines: ${locations.map(l => l + 1).join(', ')}`);
		} else {
			vscode.window.showInformationMessage(`✅ Validation complete for "${conversion.name}". No errors found!`);
		}
	}

	const validateSpecific = vscode.commands.registerCommand(
		'csvwrdfconvertor.validateSpecific',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			if (!conversion.descriptorFilePath) {
				vscode.window.showWarningMessage(`Please open fields for "${conversion.name}" first`);
				return;
			}
			validateDocument(conversion);
		}
	);

	// Command to add another input file to a conversion
	const addAnotherInput = vscode.commands.registerCommand(
		'csvwrdfconvertor.addAnotherInput',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			if (!conversion.folderPath) {
				vscode.window.showWarningMessage(`Please open fields for "${conversion.name}" first`);
				return;
			}

			try {
				// Get the conversion directory
				const conversionDir = vscode.Uri.file(conversion.folderPath);

				// Find the next available input file number
				let inputNumber = 2;
				let inputFileName: string;
				let inputFilePath: vscode.Uri;

				do {
					inputFileName = `input${inputNumber}.csv`;
					inputFilePath = vscode.Uri.joinPath(conversionDir, inputFileName);

					try {
						await vscode.workspace.fs.stat(inputFilePath);
						inputNumber++;
					} catch {
						break;
					}
				} while (true);

				// Create the new input file with default content
				const defaultContent = `# Additional Input Data ${inputNumber - 1} for ${conversion.name}
# Add your CSV data below

id,name,value
1,"Sample Data ${inputNumber - 1}",100
2,"More Data",200`;

				const encoder = new TextEncoder();
				await vscode.workspace.fs.writeFile(inputFilePath, encoder.encode(defaultContent));

				// Open the file in editor as a new tab in column 2
				const document = await vscode.workspace.openTextDocument(inputFilePath);
				await vscode.window.showTextDocument(document, {
					viewColumn: vscode.ViewColumn.Two,
					preserveFocus: true, // Don't steal focus from current tab
					preview: false // Create permanent tab, not preview
				});

				// Track this new input file
				if (!conversion.additionalInputFilePaths) {
					conversion.additionalInputFilePaths = [];
				}
				conversion.additionalInputFilePaths.push(inputFilePath.fsPath);

				// Update the descriptor file to include the new input URL
				if (conversion.descriptorFilePath) {
					try {
						const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);
						const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
						const decoder = new TextDecoder();
						const descriptorContent = decoder.decode(descriptorBytes);

						// Parse the descriptor JSON
						const descriptor = JSON.parse(descriptorContent);

						// Ensure tables array exists
						if (!descriptor.tables) {
							descriptor.tables = [];
						}

						// Add the new input file to the tables array
						const newTable = {
							url: inputFileName,
							tableSchema: {
								columns: []
							}
						};

						descriptor.tables.push(newTable);

						// Write the updated descriptor back to file
						const updatedDescriptorContent = JSON.stringify(descriptor, null, 2);
						const encoderDesc = new TextEncoder();
						await vscode.workspace.fs.writeFile(descriptorUri, encoderDesc.encode(updatedDescriptorContent));

						// Refresh the descriptor editor if it's open
						const descriptorEditor = vscode.window.visibleTextEditors.find(
							editor => editor.document.uri.fsPath === conversion.descriptorFilePath
						);
						if (descriptorEditor) {
							await vscode.commands.executeCommand('workbench.action.files.revert', descriptorUri);
						}

						vscode.window.showInformationMessage(`✅ Added new input file: ${inputFileName} and updated descriptor for "${conversion.name}"`);

					} catch (parseError) {
						vscode.window.showWarningMessage(`⚠️ Added input file but failed to update descriptor: ${parseError}`);
						vscode.window.showInformationMessage(`✅ Added new input file: ${inputFileName} for "${conversion.name}"`);
					}
				} else {
					vscode.window.showInformationMessage(`✅ Added new input file: ${inputFileName} for "${conversion.name}"`);
				}

			} catch (error) {
				vscode.window.showErrorMessage(`❌ Failed to add input file: ${error}`);
			}
		}
	);

	// Command to delete a conversion
	const deleteConversion = vscode.commands.registerCommand(
		'csvwrdfconvertor.deleteConversion',
		async (conversionItem: any) => {
			// Handle both direct TreeItem and command argument cases
			const conversionId = conversionItem?.id || conversionItem;
			const conversion = csvwActionsProvider.getConversion(conversionId);

			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			// Confirm deletion
			const choice = await vscode.window.showWarningMessage(
				`⚠️ Are you sure you want to delete the conversion "${conversion.name}"?\n\nThis will permanently delete all files and cannot be undone.`,
				{ modal: true },
				'Delete Conversion'
			);

			if (choice !== 'Delete Conversion') {
				return;
			}

			try {
				// Close any open files from this conversion first using tracked file paths
				const pathsToClose: string[] = [];

				// Add descriptor file path
				if (conversion.descriptorFilePath) {
					pathsToClose.push(conversion.descriptorFilePath);
				}

				// Add main input file path
				if (conversion.inputFilePath) {
					pathsToClose.push(conversion.inputFilePath);
				}

				// Add all tracked additional input file paths
				if (conversion.additionalInputFilePaths) {
					pathsToClose.push(...conversion.additionalInputFilePaths);
				}

				// Add output file path
				if (conversion.outputFilePath) {
					pathsToClose.push(conversion.outputFilePath);
				}

				// Close all tabs for this conversion using Tab Groups API
				if (pathsToClose.length > 0) {
					const tabsToClose: vscode.Tab[] = [];

					// Go through all tab groups and collect matching tabs
					for (const tabGroup of vscode.window.tabGroups.all) {
						for (const tab of tabGroup.tabs) {
							if (tab.input instanceof vscode.TabInputText) {
								if (pathsToClose.includes(tab.input.uri.fsPath)) {
									tabsToClose.push(tab);
								}
							}
						}
					}

					// Close all collected tabs at once
					if (tabsToClose.length > 0) {
						await vscode.window.tabGroups.close(tabsToClose);
					}
				}

				// Delete the conversion directory
				if (conversion.folderPath) {
					const folderUri = vscode.Uri.file(conversion.folderPath);
					await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false });
				}

				// Remove from tree view
				csvwActionsProvider.removeConversion(conversion.id);

				vscode.window.showInformationMessage(`✅ Deleted conversion: ${conversion.name}`);

			} catch (error) {
				vscode.window.showErrorMessage(`❌ Failed to delete conversion: ${error}`);
			}
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

			// Find the conversion object using the descriptor editor file path to get actual checkbox values
			const descriptorFilePath = descriptorEditor.document.fileName || descriptorEditor.document.uri.path;
			const conversion = findConversionByFilePath(descriptorFilePath);
			const templateIRIs = conversion?.templateIRIsChecked || false;
			const minimalMode = conversion?.minimalModeChecked || false;

			// Call the auto-conversion function with actual options from the conversion object
			const convertedOutput = await handleConversion(descriptorContent, inputContent, templateIRIs, minimalMode, conversion);

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
				const filePath = activeEditor.document.uri.fsPath;

				try {
					// Try to parse the content as JSON (CSVW descriptor)
					JSON.parse(descriptorContent);

					// Use csvwDescriptorToRdf for CSVW descriptors
					csvwDescriptorToRdf(descriptorContent, {});
					convertedOutput = "CSVW descriptor conversion completed - RDF stream generated";

				} catch (parseError) {
					// If JSON parsing fails, treat it as a CSV file and use csvUrlToRdf

					// Use csvUrlToRdf with the file path
					csvUrlToRdf(filePath, {});
					convertedOutput = "CSV file conversion completed - RDF stream generated";
				}

				// Create a new conversion for this current window conversion
				const fileName = activeEditor.document.fileName || activeEditor.document.uri.path;
				const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "CurrentWindow";
				const conversion = csvwActionsProvider.addConversion(`${baseName} Conversion`);

				// Open fields for this conversion (this will create the directory structure)
				await openFieldsForConversion(conversion);

				// Update the output file with the converted content
				if (conversion.outputFilePath) {
					const encoder = new TextEncoder();
					const outputContent = `# Converted RDF Output for ${conversion.name}
# Original source: ${fileName || 'Untitled'}
# Conversion timestamp: ${new Date().toISOString()}

${convertedOutput}`;
					await vscode.workspace.fs.writeFile(vscode.Uri.file(conversion.outputFilePath), encoder.encode(outputContent));

					// Refresh the output editor if it's open
					if (conversion.outputEditor) {
						await conversion.outputEditor.document.save();
						await vscode.commands.executeCommand('workbench.action.files.revert');
					}
				}

				vscode.window.showInformationMessage(`✅ Created conversion "${conversion.name}" and converted successfully!`);

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
				vscode.window.showErrorMessage(`❌ Conversion failed: ${errorMessage}`);
				console.error('CSVW Conversion Error:', error);
			}
		}
	);

	// Command to toggle template IRIs checkbox
	const toggleTemplateIRIs = vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleTemplateIRIs',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			// Toggle the checkbox state
			conversion.templateIRIsChecked = !conversion.templateIRIsChecked;

			// Refresh the tree view to update the checkbox display
			csvwActionsProvider.refresh();

		}
	);

	// Command to toggle minimal mode checkbox
	const toggleMinimalMode = vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleMinimalMode',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			// Toggle the checkbox state
			conversion.minimalModeChecked = !conversion.minimalModeChecked;

			// Refresh the tree view to update the checkbox display
			csvwActionsProvider.refresh();

		}
	);

	// Register all commands with the extension context
	context.subscriptions.push(
		addNewConversion,
		openConversionFields,
		closeConversionFields,
		convertSpecific,
		validateSpecific,
		addAnotherInput,
		deleteConversion,
		toggleTemplateIRIs,
		toggleMinimalMode,
		openSettings,
		clearRedUnderlinesCommand,
		changeListener,
		convertCurrentWindowCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Extension cleanup if needed
}
