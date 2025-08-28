import * as vscode from 'vscode';

/**
 * Enum representing the types of conversions supported.
 */
export enum ConversionType {
	/** CSV with metadata to RDF conversion */
	CSVW_TO_RDF = 'csvw2rdf',
	/** RDF to CSV with metadata conversion */
	RDF_TO_CSVW = 'rdf2csvw'
}

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
	rdfInputFilePath: string; // Path to the rdfInput.ttl file
	outputFilePath?: string;
	outputFilePaths?: string[];
	additionalInputFilePaths?: string[]; 
	templateIRIsChecked?: boolean;
	minimalModeChecked?: boolean;
	errorFilePath?: string; // Path to the error.txt file when conversion fails
	lastConversionType?: ConversionType; // Track the last conversion direction
}

/**
 * Union type representing items that can be displayed in the tree view.
 * Can be either a string (for actions) or a ConversionItem.
 */
export type TreeItem = string | ConversionItem;
