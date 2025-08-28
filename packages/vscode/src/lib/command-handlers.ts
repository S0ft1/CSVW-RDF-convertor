import * as vscode from 'vscode';
import { ConversionItem } from './types.js';
import { CSVWActionsProvider } from './tree-data-provider.js';
import { addRedUnderlineToLines, clearRedUnderlines, areInputFieldsOpen } from './editor-utils.js';
import { ensureFileExists, getDefaultDescriptorContent, getDefaultInputContent, getDefaultOutputContent } from './file-utils.js';
import { handleConversion } from './conversion-logic.js';

/**
 * Searches through all conversions to find one that contains the specified file path.
 * Checks descriptor, input, output, and additional input file paths for matches.
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
		}
	}
	return undefined;
}

/**
 * Creates workspace structure and opens conversion files in three-column layout.
 * Sets up directory structure, creates default files if needed, and opens them in VS Code editor.
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

	try {
		await vscode.workspace.fs.createDirectory(conversionDir);
	} catch {
	}

	conversion.folderPath = conversionDir.fsPath;

	const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');
	const inputPath = vscode.Uri.joinPath(conversionDir, 'input.csv');

	conversion.descriptorFilePath = descriptorPath.fsPath;
	conversion.inputFilePath = inputPath.fsPath;

	// Ensure descriptor and input files exist
	await ensureFileExists(descriptorPath, getDefaultDescriptorContent());
	await ensureFileExists(inputPath, getDefaultInputContent(conversion.name));

	// Open descriptor and input files
	const descriptorDocument = await vscode.workspace.openTextDocument(descriptorPath);
	const inputDocument = await vscode.workspace.openTextDocument(inputPath);

	const descriptorEditor = await vscode.window.showTextDocument(descriptorDocument, vscode.ViewColumn.One);
	const inputEditor = await vscode.window.showTextDocument(inputDocument, vscode.ViewColumn.Two);

	conversion.descriptorEditor = descriptorEditor;
	conversion.inputEditor = inputEditor;

	// Handle output files - scan directory for existing output files
	await openAppropriateOutputFiles(conversion, conversionDir);

	// Scan for additional input files
	conversion.additionalInputFilePaths = [];
	try {
		const entries = await vscode.workspace.fs.readDirectory(conversionDir);

		for (const [fileName, fileType] of entries) {
			if (fileType === vscode.FileType.File && fileName.match(/^input\d+\.csv$/)) {
				const additionalInputPath = vscode.Uri.joinPath(conversionDir, fileName);
				try {
					const additionalInputDocument = await vscode.workspace.openTextDocument(additionalInputPath);
					await vscode.window.showTextDocument(additionalInputDocument, {
						viewColumn: vscode.ViewColumn.Two,
						preserveFocus: true,
						preview: false
					});

					conversion.additionalInputFilePaths.push(additionalInputPath.fsPath);
				} catch (error) {
				}
			}
		}
	} catch (error) {
	}
}

/**
 * Opens the appropriate output files based on existing files in the directory.
 * Scans for CSV files (RDF→CSV output) or output.ttl (CSV→RDF output) and opens them.
 * @param conversion - The conversion item
 * @param conversionDir - The conversion directory URI
 */
async function openAppropriateOutputFiles(conversion: ConversionItem, conversionDir: vscode.Uri): Promise<void> {
	try {
		const entries = await vscode.workspace.fs.readDirectory(conversionDir);
		const existingOutputFiles = [];

		for (const [fileName, fileType] of entries) {
			if (fileType === vscode.FileType.File) {
				// Look for CSV files (RDF→CSV output) or TTL files (CSV→RDF output)
				if (fileName.endsWith('.csv') && !fileName.startsWith('input')) {
					existingOutputFiles.push(vscode.Uri.joinPath(conversionDir, fileName));
				} else if (fileName === 'output.ttl') {
					existingOutputFiles.push(vscode.Uri.joinPath(conversionDir, fileName));
				}
			}
		}

		if (existingOutputFiles.length > 0) {
			console.log(`Found ${existingOutputFiles.length} existing output files, opening them`);
			// Open existing output files
			for (const outputPath of existingOutputFiles) {
				try {
					const outputDocument = await vscode.workspace.openTextDocument(outputPath);
					const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
					conversion.outputEditor = outputEditor; // Keep reference to the last one opened
					conversion.outputFilePath = outputPath.fsPath; // Update the output file path
				} catch (error) {
					console.warn(`Could not open existing output file: ${outputPath.fsPath}`, error);
				}
			}
		} else {
			console.log("No existing output files found, creating default output.ttl");
			// No existing output files, create default output.ttl
			const outputPath = vscode.Uri.joinPath(conversionDir, 'output.ttl');
			conversion.outputFilePath = outputPath.fsPath;

			await ensureFileExists(outputPath, getDefaultOutputContent(conversion.name));
			const outputDocument = await vscode.workspace.openTextDocument(outputPath);
			const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
			conversion.outputEditor = outputEditor;
		}
	} catch (error) {
		console.warn("Error scanning for output files, creating default output.ttl", error);
		// Fallback: create default output.ttl
		const outputPath = vscode.Uri.joinPath(conversionDir, 'output.ttl');
		conversion.outputFilePath = outputPath.fsPath;

		await ensureFileExists(outputPath, getDefaultOutputContent(conversion.name));
		const outputDocument = await vscode.workspace.openTextDocument(outputPath);
		const outputEditor = await vscode.window.showTextDocument(outputDocument, vscode.ViewColumn.Three);
		conversion.outputEditor = outputEditor;
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
				allFilesOpen = descriptorOpen && inputOpen && outputOpen;
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

			if (conversion.descriptorFilePath) {
				pathsToClose.push(conversion.descriptorFilePath);
			}

			if (conversion.inputFilePath) {
				pathsToClose.push(conversion.inputFilePath);
			}

			if (conversion.additionalInputFilePaths) {
				pathsToClose.push(...conversion.additionalInputFilePaths);
			}

			if (conversion.outputFilePath) {
				pathsToClose.push(conversion.outputFilePath);
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

			const fileCount = pathsToClose.length;
			const fileText = fileCount === 1 ? 'file' : 'files';
			vscode.window.showInformationMessage(`✅ Closed ${fileCount} ${fileText} for conversion: ${conversion.name}`);
		}
	);

	const convertSpecific = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertSpecific',
		async (conversionId: string) => {
			const conversion = csvwActionsProvider.getConversion(conversionId);
			console.log("pres specific")
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

				const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
				const inputBytes = await vscode.workspace.fs.readFile(inputUri);
				const decoder = new TextDecoder();
				const descriptorContent = decoder.decode(descriptorBytes);
				const inputContent = decoder.decode(inputBytes);

				const templateIRIs = conversion.templateIRIsChecked || false;
				const minimalMode = conversion.minimalModeChecked || false;

				const outputFilePaths = await handleConversion(descriptorContent, inputContent, templateIRIs, minimalMode, conversion);

				// Update the conversion structure with the actual output file paths
				conversion.outputFilePaths = outputFilePaths;
				if (outputFilePaths.length === 1) {
					conversion.outputFilePath = outputFilePaths[0];
				}

				// Open all output files in the third column
				for (const outputFilePath of outputFilePaths) {
					const outputUri = vscode.Uri.file(outputFilePath);
					
					// Check if file exists, if not it was created by the conversion
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

				vscode.window.showInformationMessage(`✅ Conversion completed for: ${conversion.name}`);
			} catch (error) {
				vscode.window.showErrorMessage(`❌ Conversion failed: ${error}`);
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

				if (conversion.additionalInputFilePaths) {
					pathsToClose.push(...conversion.additionalInputFilePaths);
				}

				if (conversion.outputFilePath) {
					pathsToClose.push(conversion.outputFilePath);
				}

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
			console.log("pres tlaciktko")
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
				vscode.window.showInformationMessage('🧹 Cleared red underlines');
			}
		}
	);

	const convertCurrentWindowCommand = vscode.commands.registerCommand(
		'csvwrdfconvertor.convertCurrentWindow',
		async () => {
			const activeEditor = vscode.window.activeTextEditor;

			if (!activeEditor) {
				vscode.window.showWarningMessage('⚠️ No active editor found. Please open a file with CSVW descriptor content.');
				return;
			}

			const descriptorContent = activeEditor.document.getText().trim();

			if (!descriptorContent) {
				vscode.window.showWarningMessage('⚠️ Active editor is empty. Please add CSVW descriptor content.');
				return;
			}

			try {
				let convertedOutput: string;

				try {
					JSON.parse(descriptorContent);
					convertedOutput = "CSVW descriptor conversion completed - RDF stream generated (placeholder)";
				} catch (parseError) {
					convertedOutput = "CSV file conversion completed - RDF stream generated (placeholder)";
				}

				const fileName = activeEditor.document.fileName || activeEditor.document.uri.path;
				const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "CurrentWindow";
				const conversion = csvwActionsProvider.addConversion(`${baseName} Conversion`);

				await openFieldsForConversion(conversion);

				if (conversion.outputFilePath) {
					const encoder = new TextEncoder();
					const outputContent = `# Converted RDF Output for ${conversion.name}
# Original source: ${fileName || 'Untitled'}
# Conversion timestamp: ${new Date().toISOString()}

${convertedOutput}`;
					await vscode.workspace.fs.writeFile(vscode.Uri.file(conversion.outputFilePath), encoder.encode(outputContent));

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
		convert,
		clearRedUnderlinesCommand,
		convertCurrentWindowCommand
	);

	return {
		addNewConversion,
		openConversionFields,
		closeConversionFields,
		convertSpecific,
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
