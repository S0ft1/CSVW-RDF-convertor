import * as vscode from 'vscode';

/**
 * Ensures a file exists at the specified path, creating it with default content if it doesn't exist.
 * @param filePath - The URI path where the file should exist.
 * @param defaultContent - The default content to write if the file doesn't exist.
 */
export async function ensureFileExists(filePath: vscode.Uri, defaultContent: string) {
	try {
		await vscode.workspace.fs.stat(filePath);
	} catch {
		const encoder = new TextEncoder();
		await vscode.workspace.fs.writeFile(filePath, encoder.encode(defaultContent));
	}
}

/**
 * Generates default CSVW descriptor content for new conversions.
 * @returns A JSON string containing a basic CSVW table group structure.
 */
export function getDefaultDescriptorContent(): string {
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

/**
 * Generates default CSV input content for new conversions.
 * @param conversionName - The name of the conversion to include in the header comment.
 * @returns A CSV string with sample data and instructions.
 */
export function getDefaultInputContent(conversionName: string): string {
	return `# Input Data for ${conversionName}
# Paste your CSV data below or replace this file with your CSV

id,name,value
1,"Sample 1",100
2,"Sample 2",200`;
}

/**
 * Generates default output content for new conversions.
 * @param conversionName - The name of the conversion to include in the header comment.
 * @returns A string with placeholder content and instructions.
 */
export function getDefaultOutputContent(conversionName: string): string {
	return `# Output for ${conversionName}
# The converted RDF data will appear here after conversion

`;
}
