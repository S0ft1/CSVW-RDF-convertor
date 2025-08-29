import * as vscode from 'vscode';
import { ConversionItem } from '../types.js';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { addRedUnderlineToLines, clearRedUnderlines } from '../editor-utils.js';
import { Csvw2RdfOptions, defaultResolveJsonldFn, defaultResolveStreamFn, defaultResolveTextFn, eventEmitterToAsyncIterable, Issue, validateCsvwFromDescriptor } from '@csvw-rdf-convertor/core';
import * as path from 'path';
import { isAbsolute, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import fs from 'node:fs';
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
	const inputsDir = path.join(conversion.folderPath, 'inputs');
	const getUrl = (path: string, base: string) =>
		URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);

	const csvw2RdfOptions: Csvw2RdfOptions = {
		templateIris: false,
		minimal: false,
		baseIri: inputsDir,
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
		},
	};
	clearRedUnderlines(descriptorEditor);
	const content = descriptorEditor.document.getText();
	let errorMessages: string[] = [];
	let errorList: AsyncIterable<Issue> | null = null;
	try {
		console.log("Validating descriptor content...");
		errorList = validateCsvwFromDescriptor(content, csvw2RdfOptions);
		if (errorList) {
			for await (let error of errorList) {
				errorMessages.push(`${error.type.toUpperCase()}: ${error.message}}`);
			}
		}
	}
	catch (error) {
		errorMessages.push(`ERROR: ${(error as Error).message}`);
	}
	finally {
		addRedUnderlineToLines(descriptorEditor, errorMessages);
		if (errorMessages.length === 0) {
			vscode.window.showInformationMessage(`✅ Validation complete for "${conversion.name}". JSON syntax is valid!`);
		}
		else {
			vscode.window.showInformationMessage(`🔍 Validation complete for "${conversion.name}". Found ${errorMessages.length} issues.`);
		}
	}

}

/**
 * Validates a specific conversion's descriptor
 */
export function registerValidateSpecific(csvwActionsProvider: CSVWActionsProvider): vscode.Disposable {
	return vscode.commands.registerCommand(
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
}
