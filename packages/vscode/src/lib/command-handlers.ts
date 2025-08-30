import * as vscode from 'vscode';
import { ConversionItem } from './types.js';
import { CSVWActionsProvider } from './tree-data-provider.js';
import {
  ensureFileExists,
  getDefaultDescriptorContent,
  getDefaultInputContent,
  getDefaultOutputContent,
  getDefaultRdfInputContent,
} from './file-utils.js';
import * as path from 'path';
import {
  registerAddNewConversion,
  registerOpenConversionFields,
  registerCloseConversionFields,
  registerConvertCsvwToRdf,
  registerConvertRdfToCsvw,
  registerValidateSpecific,
  registerAddAnotherInput,
  registerDeleteConversion,
  registerToggleTemplateIRIs,
  registerToggleMinimalMode,
  registerClearRedUnderlines,
  registerConvertCurrentWindow,
} from './commands/index.js';

/**
 * Sanitizes a conversion name to be safe for use as a folder name.
 * @param name - The conversion name to sanitize
 * @returns A safe folder name
 */
export function sanitizeFolderName(name: string): string {
  // Remove or replace characters that are invalid for folder names
  return name
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters with dash
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/\.+$/, '') // Remove trailing dots
    .trim()
    .substring(0, 255); // Limit length for filesystem compatibility
}

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
      const filename = path.basename(
        descriptor.url,
        path.extname(descriptor.url),
      );
      tableUrls.push(filename);
    }

    // Handle table group with multiple tables
    if (descriptor.tables && Array.isArray(descriptor.tables)) {
      for (const table of descriptor.tables) {
        if (table.url) {
          const filename = path.basename(table.url, path.extname(table.url));
          tableUrls.push(filename);
        }
      }
    }

    // If no URLs found, ensure we have at least 'csvInput' as default
    if (tableUrls.length === 0) {
      tableUrls.push('csvInput');
    }

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
export async function createInputFilesFromDescriptor(
  inputsDir: vscode.Uri,
  conversion: ConversionItem,
  descriptorText: string,
): Promise<void> {
  if (descriptorText.trim().length === 0) {
    return;
  }
  const tableUrls = parseTableUrls(descriptorText);

  // Clean up inputs directory first - remove unwanted files
  await cleanupInputsDirectory(inputsDir, descriptorText);

  // Create files for all table URLs from descriptor
  conversion.additionalInputFilePaths =
    conversion.additionalInputFilePaths || [];

  for (let i = 0; i < tableUrls.length; i++) {
    const fileName = `${tableUrls[i]}.csv`;
    const inputPath = vscode.Uri.joinPath(inputsDir, fileName);

    // Set the first file as the main input file path
    if (i === 0) {
      await ensureFileExists(inputPath, getDefaultInputContent());
      conversion.inputFilePath = inputPath.fsPath;
    } else {
      // Additional files
      if (!conversion.additionalInputFilePaths.includes(inputPath.fsPath)) {
        await ensureFileExists(inputPath, getDefaultInputContent());
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
async function cleanupInputsDirectory(
  inputsDir: vscode.Uri,
  descriptorText: string,
): Promise<void> {
  try {
    const tableUrls = parseTableUrls(descriptorText);
    const allowedCsvFiles = new Set(tableUrls.map((url) => `${url}.csv`));
    allowedCsvFiles.add('rdfInput.ttl'); // Always keep the default RDF input file

    const entries = await vscode.workspace.fs.readDirectory(inputsDir);
    let deletedCount = 0;

    for (const [fileName, fileType] of entries) {
      if (fileType === vscode.FileType.File && !allowedCsvFiles.has(fileName)) {
        try {
          const filePath = vscode.Uri.joinPath(inputsDir, fileName);
          await vscode.workspace.fs.delete(filePath);
          deletedCount++;
        } catch (error) {
          console.warn(`Could not delete file ${fileName}:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      vscode.window.showInformationMessage(
        `🧹 Cleaned up ${deletedCount} unwanted file(s) from inputs directory`,
      );
    }
  } catch (error) {
    console.warn('Error during inputs directory cleanup:', error);
  }
}

/**
 * Updates input files based on descriptor changes during conversion execution.
 * Creates or removes input files to match table URLs in the descriptor.
 * @param conversion - The conversion item
 * @param descriptorText - The updated CSVW descriptor content
 */
export async function updateInputFilesFromDescriptor(
  conversion: ConversionItem,
  descriptorText: string,
): Promise<void> {
  if (!conversion.folderPath) {
    console.warn('Cannot update input files: conversion folder path not set');
    return;
  }

  try {
    const inputsDir = vscode.Uri.joinPath(
      vscode.Uri.file(conversion.folderPath),
      'inputs',
    );
    await createInputFilesFromDescriptor(inputsDir, conversion, descriptorText);
  } catch (error) {
    console.error('Error updating input files from descriptor:', error);
  }
}

/**
 * Scans the inputs directory and loads existing additional input files to the conversion.
 * @param conversion - The conversion item to update
 */
export async function scanAndLoadAdditionalInputs(
  conversion: ConversionItem,
): Promise<void> {
  if (!conversion.folderPath) {
    console.warn('Cannot scan inputs: conversion folder path not set');
    return;
  }

  try {
    const inputsDir = vscode.Uri.joinPath(
      vscode.Uri.file(conversion.folderPath),
      'inputs',
    );
    const entries = await vscode.workspace.fs.readDirectory(inputsDir);

    conversion.additionalInputFilePaths =
      conversion.additionalInputFilePaths || [];

    for (const [fileName, fileType] of entries) {
      if (fileType === vscode.FileType.File && fileName.endsWith('.csv')) {
        const filePath = vscode.Uri.joinPath(inputsDir, fileName).fsPath;

        // Skip the main input file and rdfInput.ttl
        if (
          filePath !== conversion.inputFilePath &&
          fileName !== 'rdfInput.ttl'
        ) {
          if (!conversion.additionalInputFilePaths.includes(filePath)) {
            conversion.additionalInputFilePaths.push(filePath);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error scanning inputs directory:', error);
  }
}

/**
 * Opens appropriate output files based on conversion type and existing files.
 * @param conversion - The conversion item to open fields for
 */
export async function openFieldsForConversion(
  conversion: ConversionItem,
): Promise<void> {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage(
      '❌ No workspace folder open. Please open a folder first.',
    );
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const extensionDir = vscode.Uri.joinPath(
    vscode.Uri.file(workspaceRoot),
    'csvw-rdf-conversions',
  );
  const conversionDir = vscode.Uri.joinPath(
    extensionDir,
    sanitizeFolderName(conversion.name),
  );
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

  const descriptorPath = vscode.Uri.joinPath(
    conversionDir,
    'descriptor.jsonld',
  );

  conversion.descriptorFilePath = descriptorPath.fsPath;

  // Ensure descriptor file exists first
  await ensureFileExists(descriptorPath, getDefaultDescriptorContent());

  // Read descriptor content to create appropriate input files
  const descriptorDocument =
    await vscode.workspace.openTextDocument(descriptorPath);
  const descriptorText = descriptorDocument.getText();

  // Create input files based on descriptor content
  await createInputFilesFromDescriptor(inputsDir, conversion, descriptorText);

  // Also create default rdfInput.ttl for potential RDF input
  const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
  await ensureFileExists(
    rdfInputPath,
    getDefaultRdfInputContent(conversion.name),
  );

  // Open descriptor first
  const descriptorEditor = await vscode.window.showTextDocument(
    descriptorDocument,
    vscode.ViewColumn.One,
  );
  conversion.descriptorEditor = descriptorEditor;

  // Set rdfInputFilePath for the conversion
  conversion.rdfInputFilePath = rdfInputPath.fsPath;

  // Load any additional input files that already exist (scan the directory)
  await scanAndLoadAdditionalInputs(conversion);

  // Open ALL input files in the second column (main input + additional inputs + RDF input)
  // Start with the main input file
  if (conversion.inputFilePath) {
    const inputDocument = await vscode.workspace.openTextDocument(
      conversion.inputFilePath,
    );
    const inputEditor = await vscode.window.showTextDocument(inputDocument, {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });
    conversion.inputEditor = inputEditor;
  }

  // Open the RDF input file
  if (conversion.rdfInputFilePath) {
    try {
      const rdfInputDocument = await vscode.workspace.openTextDocument(
        conversion.rdfInputFilePath,
      );
      await vscode.window.showTextDocument(rdfInputDocument, {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true,
        preview: false,
      });
    } catch (error) {
      console.warn(
        `Could not open RDF input file ${conversion.rdfInputFilePath}:`,
        error,
      );
    }
  }

  // Open all additional input files in the second column
  if (
    conversion.additionalInputFilePaths &&
    conversion.additionalInputFilePaths.length > 0
  ) {
    for (const additionalInputPath of conversion.additionalInputFilePaths) {
      try {
        const additionalInputDocument =
          await vscode.workspace.openTextDocument(additionalInputPath);
        await vscode.window.showTextDocument(additionalInputDocument, {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: true,
          preview: false,
        });
      } catch (error) {
        console.warn(
          `Could not open additional input file ${additionalInputPath}:`,
          error,
        );
      }
    }
  }

  // Try to open any existing output files if they exist
  await openExistingOutputFiles(conversion);
}

/**
 * Opens existing output files if they exist, using lastShownOutputFiles if available.
 * @param conversion - The conversion item
 */
async function openExistingOutputFiles(
  conversion: ConversionItem,
): Promise<void> {
  if (!conversion.folderPath) {
    return;
  }

  const outputsDir = vscode.Uri.joinPath(
    vscode.Uri.file(conversion.folderPath),
    'outputs',
  );

  try {
    // First, try to open files from lastShownOutputFiles if available
    if (
      conversion.lastShownOutputFiles &&
      conversion.lastShownOutputFiles.length > 0
    ) {
      for (const outputFilePath of conversion.lastShownOutputFiles) {
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(outputFilePath));
          const outputDocument =
            await vscode.workspace.openTextDocument(outputFilePath);
          await vscode.window.showTextDocument(
            outputDocument,
            vscode.ViewColumn.Three,
          );
        } catch (error) {
          // Note: Changed from console.log to console.warn for consistency
          console.warn(
            `Could not open last shown output file ${outputFilePath}:`,
            error,
          );
        }
      }
      return;
    }

    // Fallback: try to open any existing output files
    const entries = await vscode.workspace.fs.readDirectory(outputsDir);
    let foundExistingFile = false;
    for (const [fileName, fileType] of entries) {
      if (fileType === vscode.FileType.File) {
        const outputPath = vscode.Uri.joinPath(outputsDir, fileName);
        await ensureFileExists(
          outputPath,
          getDefaultOutputContent(conversion.name),
        );

        const outputDocument =
          await vscode.workspace.openTextDocument(outputPath);
        const outputEditor = await vscode.window.showTextDocument(
          outputDocument,
          vscode.ViewColumn.Three,
        );

        conversion.outputEditor = outputEditor;
        conversion.outputFilePath = outputPath.fsPath;
        foundExistingFile = true;
        break; // Only open the first output file found
      }
    }

    // If no existing files found, create default output file
    if (!foundExistingFile) {
      const outputPath = vscode.Uri.joinPath(outputsDir, 'output.ttl');
      await ensureFileExists(
        outputPath,
        getDefaultOutputContent(conversion.name),
      );

      const outputDocument =
        await vscode.workspace.openTextDocument(outputPath);
      const outputEditor = await vscode.window.showTextDocument(
        outputDocument,
        vscode.ViewColumn.Three,
      );

      conversion.outputEditor = outputEditor;
      conversion.outputFilePath = outputPath.fsPath;
    }
  } catch {
    // Outputs directory doesn't exist or other error, create default output file
    const outputPath = vscode.Uri.joinPath(outputsDir, 'output.ttl');
    await ensureFileExists(
      outputPath,
      getDefaultOutputContent(conversion.name),
    );

    const outputDocument = await vscode.workspace.openTextDocument(outputPath);
    const outputEditor = await vscode.window.showTextDocument(
      outputDocument,
      vscode.ViewColumn.Three,
    );

    conversion.outputEditor = outputEditor;
    conversion.outputFilePath = outputPath.fsPath;
  }
}

/**
 * Registers all VS Code commands for the CSVW RDF Convertor extension.
 * Sets up command handlers for conversion management, file operations, and editor actions.
 * @param context - The VS Code extension context for command registration
 * @param csvwActionsProvider - The tree data provider managing conversions
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  csvwActionsProvider: CSVWActionsProvider,
) {
  context.subscriptions.push(
    registerAddNewConversion(csvwActionsProvider),
    registerOpenConversionFields(csvwActionsProvider),
    registerCloseConversionFields(csvwActionsProvider),
    registerConvertCsvwToRdf(csvwActionsProvider),
    registerConvertRdfToCsvw(csvwActionsProvider),
    registerValidateSpecific(csvwActionsProvider),
    registerAddAnotherInput(csvwActionsProvider),
    registerDeleteConversion(csvwActionsProvider),
    registerToggleTemplateIRIs(csvwActionsProvider),
    registerToggleMinimalMode(csvwActionsProvider),
    registerClearRedUnderlines(),
    registerConvertCurrentWindow(csvwActionsProvider),
  );
}
