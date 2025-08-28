import * as vscode from 'vscode';
import { ConversionItem } from './types.js';
import { CSVWActionsProvider } from './tree-data-provider.js';
import { addRedUnderlineToLines, clearRedUnderlines, areInputFieldsOpen } from './editor-utils.js';
import { ensureFileExists, getDefaultDescriptorContent, getDefaultInputContent, getDefaultOutputContent, getDefaultRdfInputContent } from './file-utils.js';
import {convertCSVW2RDF,convertRDF2CSVW, isRdfContent} from './conversion-logic.js';
import { handleConversion } from './conversion-logic.js';
import * as path from 'path';

/**
 * Parses CSVW descriptor to extract table URLs for file naming.
 * @param descriptorText - The CSVW descriptor content
 * @returns Array of table URLs or filenames extracted from the descriptor
 */
function parseTableUrls(descriptorText: string): string[] {
	try {
		const descriptor = JSON.parse(descriptorText);
		const tableUrls: string[] = [];

		// Handle single table (no tables array)
		if (descriptor.url && !descriptor.tables) {
			const filename = path.basename(descriptor.url, path.extname(descriptor.url));
			tableUrls.push(filename);
			console.log(`Found single table URL: ${descriptor.url} -> ${filename}`);
		}

		// Handle table group with multiple tables
		if (descriptor.tables && Array.isArray(descriptor.tables)) {
			for (const table of descriptor.tables) {
				if (table.url) {
					const filename = path.basename(table.url, path.extname(table.url));
					tableUrls.push(filename);
					console.log(`Found table URL: ${table.url} -> ${filename}`);
				}
			}
		}

		// If no URLs found, ensure we have at least 'csvInput' as default
		if (tableUrls.length === 0) {
			console.log('No table URLs found in descriptor, using default "csvInput"');
			tableUrls.push('csvInput');
		}

		console.log(`Parsed table URLs from descriptor: ${tableUrls.join(', ')}`);
		return tableUrls;
	} catch (error) {
		console.warn('Failed to parse descriptor for table URLs:', error);
		return ['csvInput'];
	}
}

/**
 * Creates input files based on descriptor table URLs in the inputs directory.
 * @param inputsDir - The inputs directory URI
 * @param conversion - The conversion item
 * @param descriptorText - The CSVW descriptor content
 */
export async function createInputFilesFromDescriptor(inputsDir: vscode.Uri, conversion: ConversionItem, descriptorText: string): Promise<void> {
	const tableUrls = parseTableUrls(descriptorText);
	
	// Clean up inputs directory first - remove unwanted files
	await cleanupInputsDirectory(inputsDir, descriptorText);
	
	// Create files for all table URLs from descriptor
	conversion.additionalInputFilePaths = conversion.additionalInputFilePaths || [];
	
	for (let i = 0; i < tableUrls.length; i++) {
		const fileName = `${tableUrls[i]}.csv`;
		const inputPath = vscode.Uri.joinPath(inputsDir, fileName);
		
		// Set the first file as the main input file path
		if (i === 0) {
			await ensureFileExists(inputPath, getDefaultInputContent(conversion.name));
			conversion.inputFilePath = inputPath.fsPath;
		} else {
			// Additional files
			if (!conversion.additionalInputFilePaths.includes(inputPath.fsPath)) {
				await ensureFileExists(inputPath, getDefaultInputContent(`${conversion.name} - ${tableUrls[i]}`));
				conversion.additionalInputFilePaths.push(inputPath.fsPath);
			}
		}
	}
}

/**
 * Cleans up the inputs directory by removing files that are not needed.
 * Keeps only rdfInput.ttl and CSV files mentioned in the descriptor URLs.
 * @param inputsDir - The inputs directory URI
 * @param descriptorText - The CSVW descriptor content
 */
async function cleanupInputsDirectory(inputsDir: vscode.Uri, descriptorText: string): Promise<void> {
	try {
		const tableUrls = parseTableUrls(descriptorText);
		const allowedCsvFiles = new Set(tableUrls.map(url => `${url}.csv`));
		allowedCsvFiles.add('rdfInput.ttl'); // Always keep the default RDF input file

		console.log(`Cleaning inputs directory. Allowed files: ${Array.from(allowedCsvFiles).join(', ')}`);

		const entries = await vscode.workspace.fs.readDirectory(inputsDir);
		let deletedCount = 0;

		for (const [fileName, fileType] of entries) {
			if (fileType === vscode.FileType.File && !allowedCsvFiles.has(fileName)) {
				try {
					const filePath = vscode.Uri.joinPath(inputsDir, fileName);
					await vscode.workspace.fs.delete(filePath);
					console.log(`Deleted unwanted file: ${fileName}`);
					deletedCount++;
				} catch (error) {
					console.warn(`Could not delete file ${fileName}:`, error);
				}
			}
		}

		if (deletedCount > 0) {
			console.log(`Cleanup complete: Deleted ${deletedCount} unwanted file(s) from inputs directory`);
			vscode.window.showInformationMessage(`🧹 Cleaned up ${deletedCount} unwanted file(s) from inputs directory`);
		}
	} catch (error) {
		console.warn('Error during inputs directory cleanup:', error);
	}
}

/**
 * Searches through all conversions to find one that contains the specified file path.
 * Checks descriptor, input, output, and additional input file paths for matches.
 * Also checks both inputs and outputs directories for files.
 * @param filePath - The file path to search for
 * @param provider - The tree data provider containing all conversions
 * @returns The conversion item that contains the file path, or undefined if not found
 */
function findConversionByFilePath(filePath: string, provider: CSVWActionsProvider): ConversionItem | undefined {
	for (let i = 1; i < provider.conversionCounter; i++) {
		const conversion = provider.getConversion(`conversion-${i}`);
		if (conversion) {
			if (filePath === conversion.descriptorFilePath || 
				filePath === conversion.inputFilePath || 
				filePath === conversion.rdfInputFilePath ||
				filePath === conversion.outputFilePath) {
				return conversion;
			}
			
			if (conversion.additionalInputFilePaths) {
				for (const additionalPath of conversion.additionalInputFilePaths) {
					if (filePath === additionalPath) {
						return conversion;
					}
				}
			}

			// Check if file is in the inputs or outputs directories
			if (conversion.folderPath) {
				const inputsDir = path.join(conversion.folderPath, 'inputs');
				const outputsDir = path.join(conversion.folderPath, 'outputs');
				
				if (filePath.startsWith(inputsDir) || filePath.startsWith(outputsDir)) {
					return conversion;
				}
			}
		}
	}
	return undefined;
}

/**
 * Updates input files based on descriptor changes during conversion execution.
 * Creates or removes input files to match table URLs in the descriptor.
 * @param conversion - The conversion item
 * @param descriptorText - The updated CSVW descriptor content
 */
export async function updateInputFilesFromDescriptor(conversion: ConversionItem, descriptorText: string): Promise<void> {
	if (!conversion.folderPath) {
		console.warn('Cannot update input files: conversion folder path not set');
		return;
	}

	console.log(`Updating input files for conversion ${conversion.id} based on descriptor changes`);
	const inputsDir = vscode.Uri.joinPath(vscode.Uri.file(conversion.folderPath), 'inputs');
	const tableUrls = parseTableUrls(descriptorText);
	
	// Clean up inputs directory first - remove unwanted files
	await cleanupInputsDirectory(inputsDir, descriptorText);
	
	let newFilesCreated = 0;
	
	// Create files for all table URLs from descriptor
	conversion.additionalInputFilePaths = conversion.additionalInputFilePaths || [];
	
	for (let i = 0; i < tableUrls.length; i++) {
		const fileName = `${tableUrls[i]}.csv`;
		const inputPath = vscode.Uri.joinPath(inputsDir, fileName);
		
		// Set the first file as the main input file path
		if (i === 0) {
			if (conversion.inputFilePath !== inputPath.fsPath) {
				console.log(`Setting main input file: ${fileName}`);
				conversion.inputFilePath = inputPath.fsPath;
				await ensureFileExists(inputPath, getDefaultInputContent(conversion.name));
			}
		} else {
			// Additional files
			if (!conversion.additionalInputFilePaths.includes(inputPath.fsPath)) {
				console.log(`Creating new input file: ${fileName}`);
				await ensureFileExists(inputPath, getDefaultInputContent(`${conversion.name} - ${tableUrls[i]}`));
				conversion.additionalInputFilePaths.push(inputPath.fsPath);
				newFilesCreated++;
			}
		}
	}
	
	if (newFilesCreated > 0) {
		vscode.window.showInformationMessage(`✅ Created ${newFilesCreated} new input file(s) based on descriptor table URLs`);
		// Note: Files will be available for next field opening, avoiding recursion
	}
	
	console.log(`Input files update complete. Total additional files: ${conversion.additionalInputFilePaths?.length || 0}`);
}

/**
 * Creates workspace structure and opens conversion files in three-column layout.
 * Sets up directory structure with separate inputs and outputs folders, creates default files if needed, and opens them in VS Code editor.
 * Also scans for and opens any additional input files that already exist.
 * Opens appropriate output files based on conversion type and existing files.
 * @param conversion - The conversion item to open fields for
 */
export async function openFieldsForConversion(conversion: ConversionItem): Promise<void> {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('❌ No workspace folder open. Please open a folder first.');
		return;
	}

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');
	const conversionDir = vscode.Uri.joinPath(extensionDir, conversion.id);
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

	const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');

	conversion.descriptorFilePath = descriptorPath.fsPath;

	// Ensure descriptor file exists first
	await ensureFileExists(descriptorPath, getDefaultDescriptorContent());

	// Read descriptor content to create appropriate input files
	const descriptorDocument = await vscode.workspace.openTextDocument(descriptorPath);
	const descriptorText = descriptorDocument.getText();
	
	// Create input files based on descriptor content
	await createInputFilesFromDescriptor(inputsDir, conversion, descriptorText);

	// Also create default rdfInput.ttl for potential RDF input
	const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
	await ensureFileExists(rdfInputPath, getDefaultRdfInputContent(conversion.name));

	// Open descriptor and main input files
	const descriptorEditor = await vscode.window.showTextDocument(descriptorDocument, vscode.ViewColumn.One);
	const inputDocument = await vscode.workspace.openTextDocument(conversion.inputFilePath);
	const inputEditor = await vscode.window.showTextDocument(inputDocument, vscode.ViewColumn.Two);

	conversion.descriptorEditor = descriptorEditor;
	conversion.inputEditor = inputEditor;

	// Handle output files - use last shown output files if available, otherwise scan outputs directory
	if (conversion.lastShownOutputFiles && conversion.lastShownOutputFiles.length > 0) {
		// Open the last shown output files
		for (const outputFilePath of conversion.lastShownOutputFiles) {
			try {
				const outputUri = vscode.Uri.file(outputFilePath);
				const outputDocument = await vscode.workspace.openTextDocument(outputUri);
				const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
				
				// Set the conversion output properties
				if (!conversion.outputEditor) {
					conversion.outputEditor = outputEditor;
				}
				if (!conversion.outputFilePath) {
					conversion.outputFilePath = outputFilePath;
				}
			} catch (error) {
				console.warn(`Could not open last shown output file: ${outputFilePath}`, error);
			}
		}
	} else {
		// Fallback: scan outputs directory for existing output files (old behavior)
		try {
			const entries = await vscode.workspace.fs.readDirectory(outputsDir);
			let foundOutputFile = false;

			for (const [fileName, fileType] of entries) {
				if (fileType === vscode.FileType.File) {
				if (fileName.endsWith('.csv') || fileName === 'output.ttl') {
					const outputPath = vscode.Uri.joinPath(outputsDir, fileName);
					
					try {
						const outputDocument = await vscode.workspace.openTextDocument(outputPath);
						const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
						conversion.outputEditor = outputEditor;
						conversion.outputFilePath = outputPath.fsPath;
						foundOutputFile = true;
						break; // Only open the first found output file
					} catch (error) {
						console.warn(`Could not open existing output file: ${outputPath.fsPath}`, error);
					}
				}
			}
		}

			// If no existing output files found, create default output.ttl
			if (!foundOutputFile) {
				const outputPath = vscode.Uri.joinPath(outputsDir, 'output.ttl');
				conversion.outputFilePath = outputPath.fsPath;

				await ensureFileExists(outputPath, getDefaultOutputContent(conversion.name));
				const outputDocument = await vscode.workspace.openTextDocument(outputPath);
				const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
				conversion.outputEditor = outputEditor;
			}
		} catch (error) {
			console.warn("Error scanning for output files", error);
			// Fallback: create default output.ttl
			const outputPath = vscode.Uri.joinPath(outputsDir, 'output.ttl');
			conversion.outputFilePath = outputPath.fsPath;

			await ensureFileExists(outputPath, getDefaultOutputContent(conversion.name));
			const outputDocument = await vscode.workspace.openTextDocument(outputPath);
			const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
			conversion.outputEditor = outputEditor;
		}
	}

	// Always open rdfInput.ttl file for potential RDF input
	try {
		const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
		const rdfInputDocument = await vscode.workspace.openTextDocument(rdfInputPath);
		await vscode.window.showTextDocument(rdfInputDocument, {
			viewColumn: vscode.ViewColumn.Two,
			preserveFocus: true,
			preview: false
		});
		
		// Store the rdf input path for tracking
		conversion.rdfInputFilePath = rdfInputPath.fsPath;
	} catch (error) {
		console.warn("Could not open rdfInput.ttl file:", error);
	}

	// Open any additional input files that were created from descriptor
	if (conversion.additionalInputFilePaths && conversion.additionalInputFilePaths.length > 0) {
		for (const additionalInputPath of conversion.additionalInputFilePaths) {
			try {
				const additionalInputDocument = await vscode.workspace.openTextDocument(additionalInputPath);
				await vscode.window.showTextDocument(additionalInputDocument, {
					viewColumn: vscode.ViewColumn.Two,
					preserveFocus: true,
					preview: false
				});
			} catch (error) {
				console.warn(`Could not open additional input file: ${additionalInputPath}`, error);
			}
		}
	}

	// Scan for any other existing input files not created from descriptor
	try {
		const entries = await vscode.workspace.fs.readDirectory(inputsDir);

		for (const [fileName, fileType] of entries) {
			if (fileType === vscode.FileType.File && fileName.endsWith('.csv')) {
				const inputPath = vscode.Uri.joinPath(inputsDir, fileName).fsPath;
				
				// Only open if not already in our list
				if (inputPath !== conversion.inputFilePath && 
					(!conversion.additionalInputFilePaths || !conversion.additionalInputFilePaths.includes(inputPath))) {
					
					try {
						const additionalInputDocument = await vscode.workspace.openTextDocument(inputPath);
						await vscode.window.showTextDocument(additionalInputDocument, {
							viewColumn: vscode.ViewColumn.Two,
							preserveFocus: true,
							preview: false
						});

						conversion.additionalInputFilePaths = conversion.additionalInputFilePaths || [];
						conversion.additionalInputFilePaths.push(inputPath);
					} catch (error) {
						console.warn(`Could not open additional input file: ${inputPath}`, error);
					}
				}
			}
		}
	} catch (error) {
		console.warn("Error scanning inputs directory:", error);
	}
}

/**
 * Validates the descriptor document for a conversion.
 * Performs JSON syntax validation and highlights errors with red underlines in the editor.
 * @param conversion - The conversion item whose descriptor should be validated
 * @param provider - The tree data provider (unused but kept for future validation features)
 */
async function validateDocument(conversion: ConversionItem, provider: CSVWActionsProvider) {
	const descriptorEditor = vscode.window.visibleTextEditors.find(
		editor => editor.document.uri.fsPath === conversion.descriptorFilePath
	);

	if (!descriptorEditor) {
		vscode.window.showWarningMessage(`Please open the descriptor file for "${conversion.name}" first`);
		return;
	}

	clearRedUnderlines(descriptorEditor);
	const content = descriptorEditor.document.getText();
	
	try {
		JSON.parse(content);
		vscode.window.showInformationMessage(`✅ Validation complete for "${conversion.name}". JSON syntax is valid!`);
	} catch (error) {
		const errorLines = [0];
		const errorMessages = [`Invalid JSON syntax: ${error instanceof Error ? error.message : 'Unknown error'}`];
		
		addRedUnderlineToLines(descriptorEditor, errorLines, errorMessages);
		vscode.window.showInformationMessage(`🔍 Validation complete for "${conversion.name}". Found JSON syntax issues.`);
	}
}

/**
 * Registers all VS Code commands for the CSVW RDF Convertor extension.
 * Sets up command handlers for conversion management, file operations, and editor actions.
 * @param context - The VS Code extension context for command registration
 * @param csvwActionsProvider - The tree data provider managing conversions
 * @returns Object containing all registered command disposables
 */
export function registerCommands(context: vscode.ExtensionContext, csvwActionsProvider: CSVWActionsProvider) {
	const addNewConversion = vscode.commands.registerCommand(
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

	const openConversionFields = vscode.commands.registerCommand(
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
				const rdfInputOpen = conversion.rdfInputFilePath ? vscode.window.visibleTextEditors.some(
					editor => editor.document.uri.fsPath === conversion.rdfInputFilePath
				) : false;
				allFilesOpen = descriptorOpen && inputOpen && outputOpen && rdfInputOpen;
			}

			if (allFilesOpen) {
				vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already open`);
				return;
			}

			await openFieldsForConversion(conversion);
			vscode.window.showInformationMessage(`✅ Opened fields for conversion: ${conversion.name}`);
		}
	);

	const closeConversionFields = vscode.commands.registerCommand(
		'csvwrdfconvertor.closeConversionFields',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			const pathsToClose: string[] = [];

			// Add input files to close
			if (conversion.descriptorFilePath) {
				pathsToClose.push(conversion.descriptorFilePath);
			}

			if (conversion.inputFilePath) {
				pathsToClose.push(conversion.inputFilePath);
			}

			if (conversion.rdfInputFilePath) {
				pathsToClose.push(conversion.rdfInputFilePath);
			}

			if (conversion.additionalInputFilePaths) {
				pathsToClose.push(...conversion.additionalInputFilePaths);
			}

			// Find and add ALL files from the outputs directory
			try {
				const outputsDir = path.join(conversion.folderPath, 'outputs');
				const outputsDirUri = vscode.Uri.file(outputsDir);
				
				try {
					const outputFiles = await vscode.workspace.fs.readDirectory(outputsDirUri);
					for (const [fileName, fileType] of outputFiles) {
						if (fileType === vscode.FileType.File) {
							const filePath = path.join(outputsDir, fileName);
							pathsToClose.push(filePath);
						}
					}
				} catch (dirError) {
					// Outputs directory might not exist, that's okay
					console.log('Outputs directory not found or empty:', dirError);
				}
			} catch (error) {
				console.log('Error reading outputs directory:', error);
			}

			if (pathsToClose.length === 0) {
				vscode.window.showInformationMessage(`📝 Fields for "${conversion.name}" are already closed`);
				return;
			}

			const tabsToClose: vscode.Tab[] = [];

			for (const tabGroup of vscode.window.tabGroups.all) {
				for (const tab of tabGroup.tabs) {
					if (tab.input instanceof vscode.TabInputText) {
						if (pathsToClose.includes(tab.input.uri.fsPath)) {
							tabsToClose.push(tab);
						}
					}
				}
			}

			if (tabsToClose.length > 0) {
				await vscode.window.tabGroups.close(tabsToClose);
			}

			conversion.descriptorEditor = undefined;
			conversion.inputEditor = undefined;
			conversion.outputEditor = undefined;
			conversion.additionalInputFilePaths = [];
			conversion.errorFilePath = undefined;
			conversion.outputFilePath = undefined;
			conversion.outputFilePaths = undefined;

			const fileCount = pathsToClose.length;
			const fileText = fileCount === 1 ? 'file' : 'files';
			vscode.window.showInformationMessage(`✅ Closed ${fileCount} ${fileText} for conversion: ${conversion.name}`);
		}
	);

	const convertCsvwToRdf = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertCsvwToRdf',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			try {
				// Ensure necessary file paths are set for CSVW→RDF conversion
				if (!conversion.descriptorFilePath) {
					conversion.descriptorFilePath = `${conversion.folderPath}/descriptor.jsonld`;
				}
				if (!conversion.inputFilePath) {
					conversion.inputFilePath = `${conversion.folderPath}/inputs/csvInput.csv`;
				}
				
				const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);

				const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
				const decoder = new TextDecoder();
				const descriptorContent = decoder.decode(descriptorBytes);

				const templateIRIs = conversion.templateIRIsChecked || false;
				const minimalMode = conversion.minimalModeChecked || false;

				const outputFilePaths = await convertCSVW2RDF(descriptorContent, { templateIris: templateIRIs, minimal: minimalMode }, conversion);

				// Update the conversion structure with the actual output file paths
				conversion.outputFilePaths = outputFilePaths;
				if (outputFilePaths.length === 1) {
					conversion.outputFilePath = outputFilePaths[0];
				}
				
				// Clear any previous error file since conversion was successful
				conversion.errorFilePath = undefined;

				// Store the output files that we're showing to the user
				conversion.lastShownOutputFiles = [...outputFilePaths];

				// Open all output files in the third column
				for (const outputFilePath of outputFilePaths) {
					const outputUri = vscode.Uri.file(outputFilePath);
					
					const outputEditor = vscode.window.visibleTextEditors.find(
						editor => editor.document.uri.fsPath === outputFilePath
					);
					if (outputEditor) {
						await vscode.commands.executeCommand('workbench.action.files.revert', outputUri);
					}
					
					// Open the file in the third column
					await vscode.window.showTextDocument(outputUri, { 
						viewColumn: vscode.ViewColumn.Three,
						preserveFocus: false 
					});
				}

				vscode.window.showInformationMessage(`✅ CSVW→RDF conversion completed for: ${conversion.name}`);
			} catch (error) {
				// Write error to dedicated error file for user visibility
				try {
					const errorMessage = `# Manual Conversion Error (CSVW→RDF)\n# ${new Date().toISOString()}\n# Error: ${error instanceof Error ? error.message : String(error)}\n\n# Stack trace:\n# ${error instanceof Error && error.stack ? error.stack.split('\n').map(line => `# ${line}`).join('\n') : 'No stack trace available'}\n`;

					// Create error.txt in outputs directory
					const errorPath = vscode.Uri.file(`${conversion.folderPath}/outputs/error.txt`);

					await vscode.workspace.fs.writeFile(errorPath, Buffer.from(errorMessage, 'utf8'));

					// Open the error file to show the user
					const errorDocument = await vscode.workspace.openTextDocument(errorPath);
					await vscode.window.showTextDocument(errorDocument, vscode.ViewColumn.Three);

					// Update conversion structure with error file path
					conversion.errorFilePath = errorPath.fsPath;
					
					// Clear output files since there was an error
					conversion.outputFilePath = undefined;
					conversion.outputFilePaths = undefined;
					conversion.lastShownOutputFiles = [errorPath.fsPath];
				} catch (writeError) {
					vscode.window.showErrorMessage(`❌ CSVW→RDF conversion failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	);

	const convertRdfToCsvw = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertRdfToCsvw',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			try {
				// Ensure necessary file paths are set for RDF→CSVW conversion
				if (!conversion.descriptorFilePath) {
					conversion.descriptorFilePath = `${conversion.folderPath}/descriptor.jsonld`;
				}
				if (!conversion.rdfInputFilePath) {
					conversion.rdfInputFilePath = `${conversion.folderPath}/inputs/rdfInput.ttl`;
				}
				
				const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);

				const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
				const decoder = new TextDecoder();
				const descriptorContent = decoder.decode(descriptorBytes);
				console.log("descriptorContent: " + descriptorContent);

				const outputFilePaths = await convertRDF2CSVW(descriptorContent, conversion.rdfInputFilePath, conversion);

				// Update the conversion structure with the actual output file paths
				conversion.outputFilePaths = outputFilePaths;
				if (outputFilePaths.length === 1) {
					conversion.outputFilePath = outputFilePaths[0];
				}
				
				// Clear any previous error file since conversion was successful
				conversion.errorFilePath = undefined;

				// Store the output files that we're showing to the user
				conversion.lastShownOutputFiles = [...outputFilePaths];

				// Open all output files in the third column
				for (const outputFilePath of outputFilePaths) {
					const outputUri = vscode.Uri.file(outputFilePath);
					
					const outputEditor = vscode.window.visibleTextEditors.find(
						editor => editor.document.uri.fsPath === outputFilePath
					);
					if (outputEditor) {
						await vscode.commands.executeCommand('workbench.action.files.revert', outputUri);
					}
					
					// Open the file in the third column
					await vscode.window.showTextDocument(outputUri, { 
						viewColumn: vscode.ViewColumn.Three,
						preserveFocus: false 
					});
				}

				vscode.window.showInformationMessage(`✅ RDF→CSVW conversion completed for: ${conversion.name}`);
			} catch (error) {
				// Write error to dedicated error file for user visibility
				try {
					const errorMessage = `# Manual Conversion Error (RDF→CSVW)\n# ${new Date().toISOString()}\n# Error: ${error instanceof Error ? error.message : String(error)}\n\n# Stack trace:\n# ${error instanceof Error && error.stack ? error.stack.split('\n').map(line => `# ${line}`).join('\n') : 'No stack trace available'}\n`;

					// Create error.txt in outputs directory
					const errorPath = vscode.Uri.file(`${conversion.folderPath}/outputs/error.txt`);

					await vscode.workspace.fs.writeFile(errorPath, Buffer.from(errorMessage, 'utf8'));

					// Open the error file to show the user
					const errorDocument = await vscode.workspace.openTextDocument(errorPath);
					await vscode.window.showTextDocument(errorDocument, vscode.ViewColumn.Three);

					// Update conversion structure with error file path
					conversion.errorFilePath = errorPath.fsPath;
					
					// Clear output files since there was an error
					conversion.outputFilePath = undefined;
					conversion.outputFilePaths = undefined;
					conversion.lastShownOutputFiles = [errorPath.fsPath];
				} catch (writeError) {
					vscode.window.showErrorMessage(`❌ RDF→CSVW conversion failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	);

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
			validateDocument(conversion, csvwActionsProvider);
		}
	);

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
				const conversionDir = vscode.Uri.file(conversion.folderPath);

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

				const defaultContent = getDefaultInputContent(`${conversion.name} - Input ${inputNumber - 1}`);

				const encoder = new TextEncoder();
				await vscode.workspace.fs.writeFile(inputFilePath, encoder.encode(defaultContent));

				const document = await vscode.workspace.openTextDocument(inputFilePath);
				await vscode.window.showTextDocument(document, {
					viewColumn: vscode.ViewColumn.Two,
					preserveFocus: true,
					preview: false
				});

				if (!conversion.additionalInputFilePaths) {
					conversion.additionalInputFilePaths = [];
				}
				conversion.additionalInputFilePaths.push(inputFilePath.fsPath);

				if (conversion.descriptorFilePath) {
					try {
						const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);
						const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
						const decoder = new TextDecoder();
						const descriptorContent = decoder.decode(descriptorBytes);

						const descriptor = JSON.parse(descriptorContent);

						if (!descriptor.tables) {
							descriptor.tables = [];
						}

						const newTable = {
							url: inputFileName,
							tableSchema: {
								columns: []
							}
						};

						descriptor.tables.push(newTable);

						const updatedDescriptorContent = JSON.stringify(descriptor, null, 2);
						const encoderDesc = new TextEncoder();
						await vscode.workspace.fs.writeFile(descriptorUri, encoderDesc.encode(updatedDescriptorContent));

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

	const deleteConversion = vscode.commands.registerCommand(
		'csvwrdfconvertor.deleteConversion',
		async (conversionItem: any) => {
			const conversionId = conversionItem?.id || conversionItem;
			const conversion = csvwActionsProvider.getConversion(conversionId);

			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			const choice = await vscode.window.showWarningMessage(
				`⚠️ Are you sure you want to delete the conversion "${conversion.name}"?\n\nThis will permanently delete all files and cannot be undone.`,
				{ modal: true },
				'Delete Conversion'
			);

			if (choice !== 'Delete Conversion') {
				return;
			}

			try {
				const pathsToClose: string[] = [];

				if (conversion.descriptorFilePath) {
					pathsToClose.push(conversion.descriptorFilePath);
				}

				if (conversion.inputFilePath) {
					pathsToClose.push(conversion.inputFilePath);
				}

				if (conversion.rdfInputFilePath) {
					pathsToClose.push(conversion.rdfInputFilePath);
				}

				if (conversion.additionalInputFilePaths) {
					pathsToClose.push(...conversion.additionalInputFilePaths);
				}

				if (conversion.outputFilePath) {
					pathsToClose.push(conversion.outputFilePath);
				}

				// Also ensure we close rdfInput.ttl even if rdfInputFilePath is not set
				if (conversion.folderPath) {
					const rdfInputPath = vscode.Uri.joinPath(vscode.Uri.file(conversion.folderPath), 'inputs', 'rdfInput.ttl');
					if (!pathsToClose.includes(rdfInputPath.fsPath)) {
						pathsToClose.push(rdfInputPath.fsPath);
					}
				}

				console.log(`Closing ${pathsToClose.length} files for deletion:`, pathsToClose);

				if (pathsToClose.length > 0) {
					const tabsToClose: vscode.Tab[] = [];

					for (const tabGroup of vscode.window.tabGroups.all) {
						for (const tab of tabGroup.tabs) {
							if (tab.input instanceof vscode.TabInputText) {
								if (pathsToClose.includes(tab.input.uri.fsPath)) {
									tabsToClose.push(tab);
								}
							}
						}
					}

					if (tabsToClose.length > 0) {
						console.log(`Closing ${tabsToClose.length} tabs`);
						await vscode.window.tabGroups.close(tabsToClose);
					}
				}

				if (conversion.folderPath) {
					const folderUri = vscode.Uri.file(conversion.folderPath);
					await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false });
				}

				csvwActionsProvider.removeConversion(conversion.id);

				vscode.window.showInformationMessage(`✅ Deleted conversion: ${conversion.name}`);

			} catch (error) {
				vscode.window.showErrorMessage(`❌ Failed to delete conversion: ${error}`);
			}
		}
	);

	const toggleTemplateIRIs = vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleTemplateIRIs',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			conversion.templateIRIsChecked = !conversion.templateIRIsChecked;

			csvwActionsProvider.refresh();
		}
	);

	const toggleMinimalMode = vscode.commands.registerCommand(
		'csvwrdfconvertor.toggleMinimalMode',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Conversion not found');
				return;
			}

			conversion.minimalModeChecked = !conversion.minimalModeChecked;

			csvwActionsProvider.refresh();
		}
	);

	const convert = vscode.commands.registerCommand(
		'csvwrdfconvertor.convert',
		async () => {
			if (!areInputFieldsOpen()) {
				vscode.window.showWarningMessage('Please open input fields first by clicking "Show Input Fields"');
				return;
			}
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

			const descriptorContent = descriptorEditor.document.getText();
			const inputContent = inputEditor.document.getText();

			const descriptorFilePath = descriptorEditor.document.fileName || descriptorEditor.document.uri.path;
			const conversion = findConversionByFilePath(descriptorFilePath, csvwActionsProvider);
			
			if (!conversion) {
				vscode.window.showErrorMessage('❌ Could not find conversion configuration');
				return;
			}
			
			const templateIRIs = conversion.templateIRIsChecked || false;
			const minimalMode = conversion.minimalModeChecked || false;

			const outputFilePaths = await handleConversion(descriptorContent, inputContent, templateIRIs, minimalMode, conversion);

			// Update the conversion structure with the actual output file paths
			conversion.outputFilePaths = outputFilePaths;
			if (outputFilePaths.length === 1) {
				conversion.outputFilePath = outputFilePaths[0];
			}

			// Open all output files in the third column instead of editing the current output editor
			for (const outputFilePath of outputFilePaths) {
				const outputUri = vscode.Uri.file(outputFilePath);
				await vscode.window.showTextDocument(outputUri, { 
					viewColumn: vscode.ViewColumn.Three,
					preserveFocus: false 
				});
			}

			vscode.window.showInformationMessage('✅ Conversion completed!');
		}
	);

	const clearRedUnderlinesCommand = vscode.commands.registerCommand(
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

	const convertCurrentWindowCommand = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertCurrentWindow',
		async () => {
			const activeEditor = vscode.window.activeTextEditor;

			if (!activeEditor) {
				vscode.window.showWarningMessage('⚠️ No active editor found. Please open a file to create a conversion from.');
				return;
			}

			const originalContent = activeEditor.document.getText().trim();

			if (!originalContent) {
				vscode.window.showWarningMessage('⚠️ Active editor is empty. Please add content to convert.');
				return;
			}

			try {
				const fileName = activeEditor.document.fileName || activeEditor.document.uri.path;
				const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "CurrentWindow";
				const conversion = csvwActionsProvider.addConversion(`${baseName} Conversion`);

				// Create the basic conversion structure first
				const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
				const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');
				const conversionDir = vscode.Uri.joinPath(extensionDir, conversion.id);
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

				// Determine if the content is RDF or CSV
				const isRdf = isRdfContent(originalContent);

				// Create the descriptor file
				const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
				conversion.descriptorFilePath = descriptorPath.fsPath;
				await ensureFileExists(descriptorPath, getDefaultDescriptorContent());

				if (isRdf) {
					// Copy RDF content to rdfInput.ttl
					const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
					await vscode.workspace.fs.writeFile(rdfInputPath, new TextEncoder().encode(originalContent));
					conversion.rdfInputFilePath = rdfInputPath.fsPath;

					// Create default CSV input file as well
					const csvInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
					await ensureFileExists(csvInputPath, getDefaultInputContent(conversion.name));
					conversion.inputFilePath = csvInputPath.fsPath;
				} else {
					// Copy CSV content to csvInput.csv
					const csvInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
					await vscode.workspace.fs.writeFile(csvInputPath, new TextEncoder().encode(originalContent));
					conversion.inputFilePath = csvInputPath.fsPath;

					// Create default RDF input file as well
					const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
					await ensureFileExists(rdfInputPath, getDefaultRdfInputContent(conversion.name));
					conversion.rdfInputFilePath = rdfInputPath.fsPath;
				}

				// Now open the fields normally - the files are already correctly set up
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

	context.subscriptions.push(
		addNewConversion,
		openConversionFields,
		closeConversionFields,
		convertCsvwToRdf,
		convertRdfToCsvw,
		validateSpecific,
		addAnotherInput,
		deleteConversion,
		toggleTemplateIRIs,
		toggleMinimalMode,
		convert,
		clearRedUnderlinesCommand,
		convertCurrentWindowCommand
	);

	return {
		addNewConversion,
		openConversionFields,
		closeConversionFields,
		convertCsvwToRdf,
		convertRdfToCsvw,
		validateSpecific,
		addAnotherInput,
		deleteConversion,
		toggleTemplateIRIs,
		toggleMinimalMode,
		convert,
		clearRedUnderlinesCommand,
		convertCurrentWindowCommand
	};
}
