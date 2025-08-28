import * as vscode from 'vscode';

/**
 * Configuration options for minimal CSVW to RDF conversion.
 */
export interface MiniOptions {
	/** Whether to use template IRIs in the conversion */
	templateIris?: boolean;
	/** Whether to use minimal mode for reduced output */
	minimal?: boolean;
}

/**
 * Represents a single conversion item in the tree view.
 * Contains all necessary information and references for managing a conversion.
 */
export interface ConversionItem {
	id: string;
	name: string;
	folderPath: string;
	descriptorEditor?: vscode.TextEditor;
	inputEditor?: vscode.TextEditor;
	outputEditor?: vscode.TextEditor;
	descriptorFilePath?: string;
	inputFilePath: string;
	outputFilePath?: string;
	outputFilePaths?: string[]; // For multiple output files (RDF to CSV conversion)
	additionalInputFilePaths?: string[]; 
	templateIRIsChecked?: boolean;
	minimalModeChecked?: boolean;
}

/**
 * Union type representing items that can be displayed in the tree view.
 * Can be either a string (for actions) or a ConversionItem.
 */
export type TreeItem = string | ConversionItem;
