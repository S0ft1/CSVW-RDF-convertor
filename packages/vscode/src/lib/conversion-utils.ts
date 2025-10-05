import * as vscode from 'vscode';
import { ConversionItem } from './types.js';

/**
 * Reads the content of a descriptor file for a conversion
 * @param conversion - The conversion item containing the descriptor file path
 * @returns Promise resolving to the descriptor content as string
 */
export async function readDescriptorContent(
  conversion: ConversionItem,
): Promise<string> {
  if (!conversion.descriptorFilePath) {
    throw new Error('Descriptor file path not set');
  }

  const descriptorUri = vscode.Uri.file(conversion.descriptorFilePath);
  const descriptorBytes = await vscode.workspace.fs.readFile(descriptorUri);
  const decoder = new TextDecoder();
  return decoder.decode(descriptorBytes);
}

/**
 * Opens output files in VS Code editor with proper column and focus settings
 * @param outputFilePaths - Array of file paths to open
 * @param viewColumn - The column to open files in (defaults to Three)
 * @param preserveFocus - Whether to preserve focus (defaults to false)
 */
export async function openOutputFiles(
  outputFilePaths: string[],
  viewColumn: vscode.ViewColumn = vscode.ViewColumn.Three,
  preserveFocus = false,
): Promise<void> {
  for (const outputFilePath of outputFilePaths) {
    const outputUri = vscode.Uri.file(outputFilePath);

    const outputEditor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.fsPath === outputFilePath,
    );
    if (outputEditor) {
      await vscode.commands.executeCommand(
        'workbench.action.files.revert',
        outputUri,
      );
    }

    await vscode.window.showTextDocument(outputUri, {
      viewColumn,
      preserveFocus,
    });
  }
}

/**
 * Updates conversion state with successful conversion results
 * @param conversion - The conversion item to update
 * @param outputFilePaths - Array of output file paths from the conversion
 */
export function updateConversionState(
  conversion: ConversionItem,
  outputFilePaths: string[],
): void {
  conversion.outputFilePaths = outputFilePaths;
  if (outputFilePaths.length === 1) {
    conversion.outputFilePath = outputFilePaths[0];
  }
}

/**
 * Creates and displays an error file for failed conversions
 * @param conversion - The conversion item that failed
 * @param error - The error that occurred
 * @param conversionDirection - String describing the conversion direction (e.g., "CSVW→RDF")
 */
export async function handleConversionError(
  conversion: ConversionItem,
  error: unknown,
  conversionDirection: string,
): Promise<void> {
  try {
    const errorMessage = `# Manual Conversion Error (${conversionDirection})\n# ${new Date().toISOString()}\n# Error: ${error instanceof Error ? error.message : String(error)}\n\n# Stack trace:\n# ${
      error instanceof Error && error.stack
        ? error.stack
            .split('\n')
            .map((line) => `# ${line}`)
            .join('\n')
        : 'No stack trace available'
    }\n`;

    const errorPath = vscode.Uri.file(
      `${conversion.folderPath}/outputs/error.txt`,
    );

    await vscode.workspace.fs.writeFile(
      errorPath,
      Buffer.from(errorMessage, 'utf8'),
    );

    const errorDocument = await vscode.workspace.openTextDocument(errorPath);
    await vscode.window.showTextDocument(
      errorDocument,
      vscode.ViewColumn.Three,
    );

    conversion.outputFilePath = undefined;
    conversion.outputFilePaths = undefined;
  } catch {
    vscode.window.showErrorMessage(
      `❌ ${conversionDirection} conversion failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Ensures required file paths are set for a conversion with default values
 * @param conversion - The conversion item to update
 * @param descriptorFileName - Default descriptor filename (defaults to 'descriptor.json')
 * @param inputFileName - Default input filename (defaults to 'csvInput.csv')
 * @param rdfInputFileName - Default RDF input filename (defaults to 'rdfInput.ttl')
 */
export function ensureConversionPaths(
  conversion: ConversionItem,
  descriptorFileName = 'descriptor.json',
  inputFileName = 'csvInput.csv',
  rdfInputFileName = 'rdfInput.ttl',
): void {
  if (!conversion.descriptorFilePath) {
    conversion.descriptorFilePath = `${conversion.folderPath}/${descriptorFileName}`;
  }
  if (!conversion.inputFilePath) {
    conversion.inputFilePath = `${conversion.folderPath}/inputs/${inputFileName}`;
  }
  if (!conversion.rdfInputFilePath) {
    conversion.rdfInputFilePath = `${conversion.folderPath}/inputs/${rdfInputFileName}`;
  }
}

/**
 * Validates that a conversion exists and shows appropriate error if not
 * @param conversion - The conversion item to validate
 * @returns True if conversion exists, false otherwise
 */
export function validateConversionExists(
  conversion: ConversionItem | undefined,
): conversion is ConversionItem {
  if (!conversion) {
    vscode.window.showErrorMessage('❌ Conversion not found');
    return false;
  }
  return true;
}
