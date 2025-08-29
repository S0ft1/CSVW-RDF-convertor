import * as vscode from 'vscode';
import * as path from 'path';
import type { ConversionItem } from '../types.js';

/**
 * Collects all input file paths associated with a conversion.
 * Includes descriptor, input, RDF input, and additional input files.
 * @param conversion - The conversion item containing input file paths
 * @returns Array of input file paths
 */
export function collectInputFilePaths(conversion: ConversionItem): string[] {
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

	return pathsToClose;
}

/**
 * Collects all output file paths from the outputs directory.
 * Reads the directory and returns all file paths found.
 * @param conversion - The conversion item containing the folder path
 * @returns Promise resolving to array of output file paths
 */
export async function collectOutputFilePaths(conversion: ConversionItem): Promise<string[]> {
	const outputPaths: string[] = [];
	
	if (!conversion.folderPath) {
		return outputPaths;
	}

	try {
		const outputsDir = path.join(conversion.folderPath, 'outputs');
		const outputsDirUri = vscode.Uri.file(outputsDir);

		try {
			const outputFiles = await vscode.workspace.fs.readDirectory(outputsDirUri);
			for (const [fileName, fileType] of outputFiles) {
				if (fileType === vscode.FileType.File) {
					const filePath = path.join(outputsDir, fileName);
					outputPaths.push(filePath);
				}
			}
		} catch (dirError) {
			// Outputs directory not found - this is expected for new conversions
		}
	} catch (error) {
		// Error reading outputs directory - this is expected for new conversions
	}

	return outputPaths;
}

/**
 * Finds all open VS Code tabs that match the given file paths.
 * Searches through all tab groups to find matching tabs.
 * @param pathsToClose - Array of file paths to search for in open tabs
 * @returns Array of VS Code tabs that match the file paths
 */
export function findTabsToClose(pathsToClose: string[]): vscode.Tab[] {
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

	return tabsToClose;
}

/**
 * Closes VS Code tabs for the specified file paths.
 * Combines path collection, tab finding, and tab closing operations.
 * @param pathsToClose - Array of file paths to close
 * @returns Promise that resolves when tabs are closed
 */
export async function closeTabsForPaths(pathsToClose: string[]): Promise<void> {
	if (pathsToClose.length === 0) {
		return;
	}

	const tabsToClose = findTabsToClose(pathsToClose);
	if (tabsToClose.length > 0) {
		await vscode.window.tabGroups.close(tabsToClose);
	}
}
