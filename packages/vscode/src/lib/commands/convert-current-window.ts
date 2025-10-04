import * as vscode from 'vscode';
import * as path from 'path';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { ensureFileExists, getDefaultDescriptorContent, getDefaultInputContent, getDefaultRdfInputContent } from '../file-utils.js';
import { findMetadata } from '../conversion-logic.js';
import { openFieldsForConversion, sanitizeFolderName } from '../command-handlers.js';
import type { ConversionItem } from '../types.js';

/**
 * Enumeration of supported file types for conversion recognition.
 */
enum FileType {
	CSV = 'CSV',
	RDF = 'RDF',
	DESCRIPTOR = 'DESCRIPTOR'
}

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
 * For DESCRIPTOR files, copies the original content to the descriptor file.
 * @param conversion - The conversion item to update with descriptor file path
 * @param conversionDir - The main conversion directory URI
 * @param fileType - The type of the source file
 * @param filePath - The path to the source file for metadata lookup
 * @param originalContent - The original content from the editor (used for DESCRIPTOR files)
 * @param baseName - The base name of the original file (without extension)
 * @returns Promise that resolves when the descriptor file has been created
 */
async function createDescriptorFile(
	conversion: ConversionItem,
	conversionDir: vscode.Uri,
	fileType: FileType,
	filePath: string,
	originalContent?: string,
	baseName?: string
): Promise<void> {
	const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.json');
	conversion.descriptorFilePath = descriptorPath.fsPath;

	if (fileType === FileType.RDF) {
		await ensureFileExists(descriptorPath, "");
	} else if (fileType === FileType.CSV) {
		const foundMetadata = await findAssociatedMetadata(filePath);
		const tableUrl = baseName ? `${baseName}.csv` : "csvInput.csv";
		const descriptorContent = foundMetadata ?? getDefaultDescriptorContent(tableUrl);
		await ensureFileExists(descriptorPath, descriptorContent);
	} else if (fileType === FileType.DESCRIPTOR && originalContent) {
		await copyDescriptorContent(descriptorPath, originalContent);
	}
}

/**
 * Creates input files based on the content type and original file content.
 * Delegates to specialized functions based on the file type.
 * @param conversion - The conversion item to update with input file paths
 * @param inputsDir - The inputs directory URI where files will be created
 * @param fileType - The type of the source file
 * @param originalContent - The original content from the active editor
 * @param baseName - The base name of the original file (without extension)
 * @param originalFileName - The full original filename (for preserving RDF extensions)
 * @returns Promise that resolves when all input files have been created
 */
async function createInputFiles(
	conversion: ConversionItem,
	inputsDir: vscode.Uri,
	fileType: FileType,
	originalContent: string,
	baseName: string,
	originalFileName?: string
): Promise<void> {
	if (fileType === FileType.RDF) {
		await createInputFilesForRDF(inputsDir, originalContent, conversion, originalFileName);
	} else if (fileType === FileType.CSV) {
		await createInputFilesForCSVW(inputsDir, originalContent, baseName, conversion);
	} else if (fileType === FileType.DESCRIPTOR) {
		await createDefaultInputFiles(inputsDir, conversion);
	}
}

/**
 * Recognizes the file type based on its extension.
 * Classifies files as CSV, RDF, or DESCRIPTOR based on their file extensions.
 * @param fileName - The file name or path to analyze
 * @returns FileType enum value indicating the recognized file type
 */
function recognizeFile(fileName: string): FileType {
	const fileExtension = path.extname(fileName).toLowerCase();
	
	if (fileExtension === '.csv') {
		return FileType.CSV;
	}
	
	if (['.json', '.jsonld'].includes(fileExtension)) {
		return FileType.DESCRIPTOR;
	}
	
	if (['.nq', '.trig', '.rdf', '.ttl', '.nt'].includes(fileExtension)) {
		return FileType.RDF;
	}
	
	return FileType.RDF;
}

/**
 * Creates default CSV input file for conversions.
 * @param inputsDir - The inputs directory URI where files will be created
 * @param conversion - The conversion item to update with file paths
 * @returns Promise that resolves when the CSV input file has been created
 */
async function createDefaultCsvInputFile(inputsDir: vscode.Uri, conversion: ConversionItem): Promise<void> {
	const csvInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
	await ensureFileExists(csvInputPath, getDefaultInputContent());
	conversion.inputFilePath = csvInputPath.fsPath;
}

/**
 * Creates default RDF input file for conversions.
 * @param inputsDir - The inputs directory URI where files will be created
 * @param conversion - The conversion item to update with file paths
 * @returns Promise that resolves when the RDF input file has been created
 */
async function createDefaultRdfInputFile(inputsDir: vscode.Uri, conversion: ConversionItem): Promise<void> {
	const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
	await ensureFileExists(rdfInputPath, getDefaultRdfInputContent());
	conversion.rdfInputFilePath = rdfInputPath.fsPath;
}

/**
 * Creates default input files for descriptor conversions.
 * Creates both default CSV and RDF input files.
 * @param inputsDir - The inputs directory URI where files will be created
 * @param conversion - The conversion item to update with file paths
 * @returns Promise that resolves when both input files have been created
 */
async function createDefaultInputFiles(inputsDir: vscode.Uri, conversion: ConversionItem): Promise<void> {
	await createDefaultCsvInputFile(inputsDir, conversion);
	await createDefaultRdfInputFile(inputsDir, conversion);
}

/**
 * Copies descriptor content to the descriptor.json file.
 * @param descriptorPath - The path to the descriptor file
 * @param descriptorContent - The descriptor content to copy
 * @returns Promise that resolves when the file has been written
 */
async function copyDescriptorContent(descriptorPath: vscode.Uri, descriptorContent: string): Promise<void> {
	await vscode.workspace.fs.writeFile(descriptorPath, new TextEncoder().encode(descriptorContent));
}

/**
 * Creates input files specifically for RDF file conversions.
 * Sets up the RDF input file with the original content preserving the file extension and creates a default CSV input file.
 * @param inputsDir - The inputs directory URI where files will be created
 * @param originalContent - The original RDF content from the active editor
 * @param conversion - The conversion item to update with file paths
 * @param originalFileName - The original filename to preserve the extension
 * @returns Promise that resolves when both input files have been created
 */
async function createInputFilesForRDF(inputsDir: vscode.Uri, originalContent: string, conversion: ConversionItem, originalFileName?: string): Promise<void> {
	let rdfFileName = 'rdfInput.ttl';
	
	if (originalFileName) {
		const extension = path.extname(originalFileName);
		const baseName = path.basename(originalFileName, extension);
		rdfFileName = `${baseName}${extension}`;
	}
	
	const rdfInputPath = vscode.Uri.joinPath(inputsDir, rdfFileName);
	await vscode.workspace.fs.writeFile(rdfInputPath, new TextEncoder().encode(originalContent));
	conversion.rdfInputFilePath = rdfInputPath.fsPath;

	await createDefaultCsvInputFile(inputsDir, conversion);
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
	
	await createDefaultRdfInputFile(inputsDir, conversion);
}/**
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

				const fileType = recognizeFile(fileName);
				const originalFileName = fileName.split(/[/\\]/).pop() || "CurrentWindow";
				const baseName = originalFileName.replace(/\.[^/.]+$/, "") || "CurrentWindow";

				await createInputFiles(conversion, inputsDir, fileType, content, baseName, originalFileName);
				await createDescriptorFile(conversion, conversionDir, fileType, editor.document.uri.path, content, baseName);
				await openFieldsForConversion(conversion);

				const fileTypeStr = fileType === FileType.RDF ? 'RDF' : fileType === FileType.CSV ? 'CSV' : 'DESCRIPTOR';
				vscode.window.showInformationMessage(`✅ Created conversion "${conversion.name}" from ${fileTypeStr} file!`);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
				vscode.window.showErrorMessage(`❌ Failed to create conversion: ${errorMessage}`);
				console.error('CSVW Conversion Creation Error:', error);
			}
		}
	);
}
