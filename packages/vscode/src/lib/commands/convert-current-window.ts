import * as vscode from 'vscode';
import * as path from 'path';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { ensureFileExists, getDefaultDescriptorContent, getDefaultInputContent, getDefaultRdfInputContent } from '../file-utils.js';
import { findMetadata } from '../conversion-logic.js';
import { openFieldsForConversion, sanitizeFolderName } from '../command-handlers.js';
import type { ConversionItem } from '../types.js';

/**
 * Validates that there is an active editor with content available for conversion.
 * Checks for both editor availability and non-empty content.
 * @returns Object containing the active editor and content, or null if validation fails
 */
function validateActiveEditor(): { editor: vscode.TextEditor; content: string } | null {
	const activeEditor = vscode.window.activeTextEditor;

	if (!activeEditor) {
		vscode.window.showWarningMessage('⚠️ No active editor found. Please open a file to create a conversion from.');
		return null;
	}

	const originalContent = activeEditor.document.getText().trim();

	if (!originalContent) {
		vscode.window.showWarningMessage('⚠️ Active editor is empty. Please add content to convert.');
		return null;
	}

	return { editor: activeEditor, content: originalContent };
}

/**
 * Prompts user for conversion name with intelligent defaults based on the file.
 * Extracts base name from file path and creates a meaningful default conversion name.
 * @param fileName - The full file name or path to extract base name from
 * @returns Promise resolving to the user-entered conversion name, or null if cancelled
 */
async function promptForConversionName(fileName: string): Promise<string | null> {
	const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "CurrentWindow";
	const defaultName = `${baseName} Conversion`;

	const conversionName = await vscode.window.showInputBox({
		prompt: 'Enter a name for the new conversion',
		placeHolder: defaultName,
		value: defaultName
	});

	if (conversionName === undefined) {
		return null;
	}

	return conversionName.trim() || defaultName;
}

/**
 * Creates the directory structure for a new conversion in the workspace.
 * Sets up the main conversion directory along with inputs and outputs subdirectories.
 * Updates the conversion item with the folder path for future reference.
 * @param conversion - The conversion item to create directories for
 * @returns Promise resolving to an object containing all created directory URIs
 */
async function createConversionDirectories(conversion: ConversionItem): Promise<{
	conversionDir: vscode.Uri;
	inputsDir: vscode.Uri;
	outputsDir: vscode.Uri;
}> {
	const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
	const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');
	const conversionDir = vscode.Uri.joinPath(extensionDir, sanitizeFolderName(conversion.name));
	const inputsDir = vscode.Uri.joinPath(conversionDir, 'inputs');
	const outputsDir = vscode.Uri.joinPath(conversionDir, 'outputs');

	try {
		await vscode.workspace.fs.createDirectory(conversionDir);
		await vscode.workspace.fs.createDirectory(inputsDir);
		await vscode.workspace.fs.createDirectory(outputsDir);
	} catch {
		// Directory already exists
	}

	conversion.folderPath = conversionDir.fsPath;
	return { conversionDir, inputsDir, outputsDir };
}

/**
 * Attempts to find and read associated metadata file for CSV files.
 * Searches for metadata files using the CSVW specification lookup rules.
 * @param filePath - The path to the CSV file to find metadata for
 * @returns Promise resolving to metadata content as string, or null if not found or read error
 */
async function findAssociatedMetadata(filePath: string): Promise<string | null> {
	const metadataPath = await findMetadata(filePath);
	if (!metadataPath) return null;

	try {
		const metadataUri = vscode.Uri.file(metadataPath);
		const metadataBytes = await vscode.workspace.fs.readFile(metadataUri);
		const decoder = new TextDecoder();
		return decoder.decode(metadataBytes);
	} catch (err) {
		console.warn("Could not read associated metadata file: " + metadataPath, err);
		return null;
	}
}

/**
 * Creates the descriptor file based on file type and metadata availability.
 * For CSV files, attempts to use associated metadata or falls back to default descriptor.
 * For RDF files, creates an empty descriptor that will be populated during conversion.
 * @param conversion - The conversion item to update with descriptor file path
 * @param conversionDir - The main conversion directory URI
 * @param isRdf - True if the source file is an RDF file, false for CSV files
 * @param filePath - The path to the source file for metadata lookup
 * @returns Promise that resolves when the descriptor file has been created
 */
async function createDescriptorFile(
	conversion: ConversionItem,
	conversionDir: vscode.Uri,
	isRdf: boolean,
	filePath: string,
	baseName?: string
): Promise<void> {
	const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
	conversion.descriptorFilePath = descriptorPath.fsPath;

	if (isRdf) {
		await ensureFileExists(descriptorPath, "");
	} else {
		const foundMetadata = await findAssociatedMetadata(filePath);
		const tableUrl = baseName ? `${baseName}.csv` : "csvInput.csv";
		const descriptorContent = foundMetadata ?? getDefaultDescriptorContent(tableUrl);
		await ensureFileExists(descriptorPath, descriptorContent);
	}
}

/**
 * Creates input files based on the content type and original file content.
 * Delegates to specialized functions based on whether the source is RDF or CSV.
 * @param conversion - The conversion item to update with input file paths
 * @param inputsDir - The inputs directory URI where files will be created
 * @param isRdf - True if the source file is an RDF file, false for CSV files
 * @param originalContent - The original content from the active editor
 * @param baseName - The base name of the original file (without extension)
 * @returns Promise that resolves when all input files have been created
 */
async function createInputFiles(
	conversion: ConversionItem,
	inputsDir: vscode.Uri,
	isRdf: boolean,
	originalContent: string,
	baseName: string
): Promise<void> {
	if (isRdf) {
		await createInputFilesForRDF(inputsDir, originalContent, conversion);
	} else {
		await createInputFilesForCSVW(inputsDir, originalContent, baseName, conversion);
	}
}

/**
 * Determines if the file is an RDF file based on its extension.
 * Uses file extension analysis to classify files as RDF or CSV.
 * @param fileName - The file name or path to analyze
 * @returns True if the file is considered an RDF file (not .csv), false for CSV files
 */
function isRdfFile(fileName: string): boolean {
	const fileExtension = path.extname(fileName).toLowerCase();
	return fileExtension !== '.csv';
}

/**
 * Creates input files specifically for RDF file conversions.
 * Sets up the rdfInput.ttl file with the original RDF content and creates a default CSV input file.
 * @param inputsDir - The inputs directory URI where files will be created
 * @param originalContent - The original RDF content from the active editor
 * @param conversion - The conversion item to update with file paths
 * @returns Promise that resolves when both input files have been created
 */
async function createInputFilesForRDF(inputsDir: vscode.Uri, originalContent: string, conversion: ConversionItem): Promise<void> {
	const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
	await vscode.workspace.fs.writeFile(rdfInputPath, new TextEncoder().encode(originalContent));
	conversion.rdfInputFilePath = rdfInputPath.fsPath;

	const csvInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
	await ensureFileExists(csvInputPath, getDefaultInputContent());
	conversion.inputFilePath = csvInputPath.fsPath;
}

/**
 * Creates input files specifically for CSVW file conversions.
 * Sets up the CSV input file with the original content and creates a default RDF input file.
 * @param inputsDir - The inputs directory URI where files will be created
 * @param originalContent - The original CSV content from the active editor
 * @param baseName - The base name of the original file (without extension) for naming the CSV file
 * @param conversion - The conversion item to update with file paths
 * @returns Promise that resolves when both input files have been created
 */
async function createInputFilesForCSVW(inputsDir: vscode.Uri, originalContent: string, baseName: string, conversion: ConversionItem): Promise<void> {
	const csvInputPath = vscode.Uri.joinPath(inputsDir, baseName + ".csv");
	await vscode.workspace.fs.writeFile(csvInputPath, new TextEncoder().encode(originalContent));
	conversion.inputFilePath = csvInputPath.fsPath;
	const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
	await ensureFileExists(rdfInputPath, getDefaultRdfInputContent());
	conversion.rdfInputFilePath = rdfInputPath.fsPath;
}

/**
 * Creates a conversion from the currently active window/file.
 * Supports both CSV and RDF file types with automatic metadata detection for CSV files.
 * @param csvwActionsProvider - The tree data provider managing conversions
 * @returns VS Code disposable for the command registration
 */
export function registerConvertCurrentWindow(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
		'csvwrdfconvertor.convertCurrentWindow',
		async () => {
			const validation = validateActiveEditor();
			if (!validation) return;

			const { editor, content } = validation;

			try {
				const fileName = editor.document.fileName || editor.document.uri.path;
				const conversionName = await promptForConversionName(fileName);

				if (!conversionName) return;

				const conversion = csvwActionsProvider.addConversion(conversionName);
				const { conversionDir, inputsDir } = await createConversionDirectories(conversion);

				const isRdf = isRdfFile(fileName);
				const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "CurrentWindow";

				await createInputFiles(conversion, inputsDir, isRdf, content, baseName);
				await createDescriptorFile(conversion, conversionDir, isRdf, editor.document.uri.path, baseName);
				await openFieldsForConversion(conversion);

				const fileType = isRdf ? 'RDF' : 'CSV';
				vscode.window.showInformationMessage(`✅ Created conversion "${conversion.name}" from ${fileType} file!`);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
				vscode.window.showErrorMessage(`❌ Failed to create conversion: ${errorMessage}`);
				console.error('CSVW Conversion Creation Error:', error);
			}
		}
	);
}
