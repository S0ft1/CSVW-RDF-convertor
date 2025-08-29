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
    "url": "csvInput.csv",
    "tableSchema": {
      "columns": [{
        "name": "id",
        "datatype": "integer"
      }, {
        "name": "name",
        "datatype": "string"
      }, {
        "name": "value",
        "datatype": "decimal"
      }]
    }
  }]
}`;
}

/**
 * Generates default CSV input content for new conversions.
 * @param conversionName - The name of the conversion to include in the header comment.
 * @returns A CSV string with sample data and instructions.
 */
export function getDefaultInputContent(): string {
	return `id,name,value
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

/**
 * Generates default RDF input content for new conversions.
 * @param conversionName - The name of the conversion to include in the header comment.
 * @returns A Turtle RDF string with sample data.
 */
export function getDefaultRdfInputContent(conversionName: string): string {
	return `@prefix csvw: <http://www.w3.org/ns/csvw#>.
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.

[ a csvw:TableGroup;
  csvw:table [ a csvw:Table;
      csvw:row [ a csvw:Row;
          csvw:describes [
            <csvInput.csv#id> 1;
            <csvInput.csv#name> "Sample 1";
            <csvInput.csv#value> "100"^^<http://www.w3.org/2001/XMLSchema#decimal> ;
          ];
          csvw:rownum 1;
          csvw:url <csvInput.csv#row=2>
        ], [ a csvw:Row;
          csvw:describes [
                <csvInput.csv#id> 2;
                <csvInput.csv#name> "Sample 2";
                <csvInput.csv#value> "200"^^<http://www.w3.org/2001/XMLSchema#decimal> ;
          ];
          csvw:rownum 2;
          csvw:url <csvInput.csv#row=3>
        ];
      csvw:url <csvInput.csv>
    ]
].`
}
