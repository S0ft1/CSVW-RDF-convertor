import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { getDefaultInputContent } from '../file-utils.js';
import { ConversionItem } from '../types.js';

/**
 * Finds the next available input file number and generates the filename
 */
async function findNextInputFileName(inputsDir: vscode.Uri): Promise<{ fileName: string; filePath: vscode.Uri}> {
	try {
		const files = await vscode.workspace.fs.readDirectory(inputsDir);
		const inputNumber = files.length; // Total files = n CSV + 1 RDF, so next input is files.length
		const inputFileName = `input${inputNumber}.csv`;
		const inputFilePath = vscode.Uri.joinPath(inputsDir, inputFileName);

		return {
			fileName: inputFileName,
			filePath: inputFilePath
		};
	} catch (error) {
		vscode.window.showWarningMessage('Error reading inputs directory:');
	}
	const FailedInputFileName: string = `inputX.csv`;
	return {
		fileName: FailedInputFileName,
		filePath: vscode.Uri.joinPath(inputsDir,FailedInputFileName)
	};
}

/**
 * Creates and opens a new input file
 */
async function createAndOpenInputFile(inputFilePath: vscode.Uri): Promise<void> {
	const defaultContent = getDefaultInputContent();
	const encoder = new TextEncoder();
	await vscode.workspace.fs.writeFile(inputFilePath, encoder.encode(defaultContent));

	const document = await vscode.workspace.openTextDocument(inputFilePath);
	await vscode.window.showTextDocument(document, {
		viewColumn: vscode.ViewColumn.Two,
		preserveFocus: true,
		preview: false
	});
}

/**
 * Converts a single table descriptor to a table group descriptor
 */
function convertSingleTableToTableGroup(descriptor: any): void {
	if (descriptor.url && !descriptor.tables) {
		const singleTable = { ...descriptor };
		delete singleTable['@context'];
		descriptor.tables = [singleTable];
		delete descriptor.url;
		delete descriptor.tableSchema;
	}
}

/**
 * Creates a new table definition based on existing tables
 */
function createNewTableDefinition(descriptor: any, inputFileName: string): any {
	let newTable = {
		url: inputFileName,
		tableSchema: {
			columns: []
		}
	};

	if (descriptor.tables && descriptor.tables.length > 0) {
		const existingTable = descriptor.tables[0];
		const propertiesToCopy = { ...existingTable };

		delete propertiesToCopy.url;
		delete propertiesToCopy.tableSchema;

		newTable = {
			...propertiesToCopy,
			url: inputFileName,
			tableSchema: {
				columns: []
			}
		};
	}

	return newTable;
}

/**
 * Updates the descriptor file with the new table definition
 */
async function updateDescriptorFile(conversion: ConversionItem, inputFileName: string): Promise<void> {
	const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath!);
	const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
	const decoder = new TextDecoder();
	const descriptorContent = decoder.decode(descriptorBytes);

	const descriptor = JSON.parse(descriptorContent);

	convertSingleTableToTableGroup(descriptor);

	if (!descriptor.tables) {
		descriptor.tables = [];
	}

	const newTable = createNewTableDefinition(descriptor, inputFileName);
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
}

/**
 * Adds another input file to a conversion
 */
export function registerAddAnotherInput(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
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
				const inputsDir = vscode.Uri.joinPath(vscode.Uri.file(conversion.folderPath), 'inputs');
				const { fileName: inputFileName, filePath: inputFilePath} = await findNextInputFileName(inputsDir);
				await createAndOpenInputFile(inputFilePath);

				if (!conversion.additionalInputFilePaths) {
					conversion.additionalInputFilePaths = [];
				}
				conversion.additionalInputFilePaths.push(inputFilePath.fsPath);

				if (conversion.descriptorFilePath) {
					try {
						await updateDescriptorFile(conversion, inputFileName);
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
}
