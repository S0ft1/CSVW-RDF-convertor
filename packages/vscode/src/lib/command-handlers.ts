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
  registerSelectRdfSerialization,
  registerToggleTemplateIRIs,
  registerToggleMinimalMode,
  registerClearRedUnderlines,
  registerConvertCurrentWindow,
} from './commands/index.js';
import { getOutputFileExtension } from './conversion-logic.js';

/**
 * Sanitizes a conversion name to be safe for use as a folder name.
 * @param name - The conversion name to sanitize
 * @returns A safe folder name
 */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .substring(0, 255);
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

    if (descriptor.url && !descriptor.tables) {
      const filename = path.basename(
        descriptor.url,
        path.extname(descriptor.url),
      );
      tableUrls.push(filename);
    }
    if (descriptor.tables && Array.isArray(descriptor.tables)) {
      for (const table of descriptor.tables) {
        if (table.url) {
          const filename = path.basename(table.url, path.extname(table.url));
          tableUrls.push(filename);
        }
      }
    }

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
  await cleanupInputsDirectory(inputsDir, descriptorText);
  await createInputFilesFromUrls(inputsDir, conversion, tableUrls);
}

/**
 * Creates input files based on table URLs from the descriptor.
 * @param inputsDir - The inputs directory URI
 * @param conversion - The conversion item
 * @param tableUrls - Array of table URLs from the descriptor
 */
async function createInputFilesFromUrls(
  inputsDir: vscode.Uri,
  conversion: ConversionItem,
  tableUrls: string[],
): Promise<void> {
  conversion.additionalInputFilePaths = conversion.additionalInputFilePaths || [];

  for (let i = 0; i < tableUrls.length; i++) {
    const fileName = `${tableUrls[i]}.csv`;
    const inputPath = vscode.Uri.joinPath(inputsDir, fileName);

    if (i === 0) {
      await createMainInputFile(inputPath, conversion);
    } else {
      await createAdditionalInputFile(inputPath, conversion);
    }
  }
}

/**
 * Creates the main input file for a conversion.
 * @param inputPath - The input file path URI
 * @param conversion - The conversion item
 */
async function createMainInputFile(
  inputPath: vscode.Uri,
  conversion: ConversionItem,
): Promise<void> {
  await ensureFileExists(inputPath, getDefaultInputContent());
  conversion.inputFilePath = inputPath.fsPath;
}

/**
 * Creates an additional input file for a conversion.
 * @param inputPath - The input file path URI
 * @param conversion - The conversion item
 */
async function createAdditionalInputFile(
  inputPath: vscode.Uri,
  conversion: ConversionItem,
): Promise<void> {
  if (!conversion.additionalInputFilePaths!.includes(inputPath.fsPath)) {
    await ensureFileExists(inputPath, getDefaultInputContent());
    conversion.additionalInputFilePaths!.push(inputPath.fsPath);
  }
}

/**
 * Checks if a filename is an RDF input file (includes various RDF formats).
 * @param fileName - The filename to check
 * @returns True if the file is an RDF input file
 */
function isRdfInputFile(fileName: string): boolean {
  const rdfExtensions = ['.ttl', '.nt', '.nq', '.trig', '.rdf', '.jsonld'];
  const extension = path.extname(fileName).toLowerCase();
  
  // Check if it's the default rdfInput file or has RDF extension
  return fileName === 'rdfInput.ttl' || 
         (fileName.startsWith('rdfInput.') && rdfExtensions.includes(extension)) ||
         rdfExtensions.includes(extension);
}

/**
 * Cleans up the inputs directory by removing files that are not needed.
 * Keeps only RDF input files and CSV files mentioned in the descriptor URLs.
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

    const entries = await vscode.workspace.fs.readDirectory(inputsDir);
    let deletedCount = 0;

    for (const [fileName, fileType] of entries) {
      if (fileType === vscode.FileType.File && 
          !allowedCsvFiles.has(fileName) && 
          !isRdfInputFile(fileName)) {
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

    conversion.additionalInputFilePaths = conversion.additionalInputFilePaths || [];

    const additionalFiles = getAdditionalInputFiles(entries, inputsDir, conversion);
    addUniqueFilesToConversion(additionalFiles, conversion);
  } catch (error) {
    console.warn('Error scanning inputs directory:', error);
  }
}

/**
 * Filters directory entries to find additional input files.
 * @param entries - Directory entries from the inputs folder
 * @param inputsDir - The inputs directory URI
 * @param conversion - The conversion item for comparison
 * @returns Array of additional input file paths
 */
function getAdditionalInputFiles(
  entries: [string, vscode.FileType][],
  inputsDir: vscode.Uri,
  conversion: ConversionItem,
): string[] {
  const additionalFiles: string[] = [];

  for (const [fileName, fileType] of entries) {
    if (shouldIncludeAsAdditionalInput(fileName, fileType, inputsDir, conversion)) {
      const filePath = vscode.Uri.joinPath(inputsDir, fileName).fsPath;
      additionalFiles.push(filePath);
    }
  }

  return additionalFiles;
}

/**
 * Determines if a file should be included as an additional input file.
 * @param fileName - The file name
 * @param fileType - The file type
 * @param inputsDir - The inputs directory URI
 * @param conversion - The conversion item for comparison
 * @returns True if the file should be included as additional input
 */
function shouldIncludeAsAdditionalInput(
  fileName: string,
  fileType: vscode.FileType,
  inputsDir: vscode.Uri,
  conversion: ConversionItem,
): boolean {
  if (fileType !== vscode.FileType.File || !fileName.endsWith('.csv')) {
    return false;
  }

  const filePath = vscode.Uri.joinPath(inputsDir, fileName).fsPath;

  return filePath !== conversion.inputFilePath && !isRdfInputFile(fileName);
}

/**
 * Adds unique files to the conversion's additional input files list.
 * @param additionalFiles - Array of file paths to add
 * @param conversion - The conversion item to update
 */
function addUniqueFilesToConversion(
  additionalFiles: string[],
  conversion: ConversionItem,
): void {
  for (const filePath of additionalFiles) {
    if (!conversion.additionalInputFilePaths!.includes(filePath)) {
      conversion.additionalInputFilePaths!.push(filePath);
    }
  }
}

/**
 * Opens appropriate output files based on conversion type and existing files.
 * @param conversion - The conversion item to open fields for
 */
export async function openFieldsForConversion(
  conversion: ConversionItem,
): Promise<void> {
  if (!validateWorkspace()) {
    return;
  }

  const directories = setupConversionDirectories(conversion);
  await createConversionDirectories(directories);

  conversion.folderPath = directories.conversionDir.fsPath;

  const descriptorPath = await setupDescriptorFile(directories.conversionDir, conversion);
  const descriptorDocument = await vscode.workspace.openTextDocument(descriptorPath);
  const descriptorText = descriptorDocument.getText();

  await createInputFilesFromDescriptor(directories.inputsDir, conversion, descriptorText);
  await setupRdfInputFile(directories.inputsDir, conversion);

  await vscode.window.showTextDocument(
    descriptorDocument,
    vscode.ViewColumn.One,
  );

  await scanAndLoadAdditionalInputs(conversion);
  await openAllInputFiles(conversion);
  await openExistingOutputFiles(conversion);
}

/**
 * Validates that a workspace is open.
 * @returns True if workspace is valid, false otherwise
 */
function validateWorkspace(): boolean {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage(
      '❌ No workspace folder open. Please open a folder first.',
    );
    return false;
  }
  return true;
}

/**
 * Sets up the directory structure for a conversion.
 * @param conversion - The conversion item
 * @returns Directory URIs for the conversion
 */
function setupConversionDirectories(conversion: ConversionItem) {
  const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
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

  return { conversionDir, inputsDir, outputsDir };
}

/**
 * Creates the necessary directories for a conversion.
 * @param directories - The directory structure object
 */
async function createConversionDirectories(directories: {
  conversionDir: vscode.Uri;
  inputsDir: vscode.Uri;
  outputsDir: vscode.Uri;
}): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(directories.conversionDir);
    await vscode.workspace.fs.createDirectory(directories.inputsDir);
    await vscode.workspace.fs.createDirectory(directories.outputsDir);
  } catch {
  }
}

/**
 * Sets up the descriptor file for a conversion.
 * @param conversionDir - The conversion directory URI
 * @param conversion - The conversion item
 * @returns The descriptor file path URI
 */
async function setupDescriptorFile(
  conversionDir: vscode.Uri,
  conversion: ConversionItem,
): Promise<vscode.Uri> {
  const descriptorPath = vscode.Uri.joinPath(
    conversionDir,
    'descriptor.json',
  );

  conversion.descriptorFilePath = descriptorPath.fsPath;
  await ensureFileExists(descriptorPath, getDefaultDescriptorContent());

  return descriptorPath;
}

/**
 * Sets up the RDF input file for a conversion.
 * Only creates the default rdfInput.ttl if no RDF input file is already set.
 * @param inputsDir - The inputs directory URI
 * @param conversion - The conversion item
 */
async function setupRdfInputFile(
  inputsDir: vscode.Uri,
  conversion: ConversionItem,
): Promise<void> {
  if (!conversion.rdfInputFilePath) {
    const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
    await ensureFileExists(rdfInputPath, getDefaultRdfInputContent());
    conversion.rdfInputFilePath = rdfInputPath.fsPath;
  }
}

/**
 * Opens all input files (main, additional, and RDF) in the editor.
 * @param conversion - The conversion item
 */
async function openAllInputFiles(conversion: ConversionItem): Promise<void> {
  if (conversion.inputFilePath) {
    await openSingleInputFile(conversion.inputFilePath, true);
  }

  if (conversion.rdfInputFilePath) {
    await openSingleInputFile(conversion.rdfInputFilePath);
  }

  if (conversion.additionalInputFilePaths && conversion.additionalInputFilePaths.length > 0) {
    for (const additionalInputPath of conversion.additionalInputFilePaths) {
      await openSingleInputFile(additionalInputPath);
    }
  }
}

/**
 * Opens a single input file in the editor.
 * @param filePath - The file path to open
 * @param isMainInput - Whether this is the main input file
 */
async function openSingleInputFile(
  filePath: string,
  isMainInput = false,
): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });
  } catch (error) {
    const fileType = isMainInput ? 'main input' : 'input';
    console.warn(`Could not open ${fileType} file ${filePath}:`, error);
  }
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
    if (await tryOpenLastShownOutputFiles(conversion)) {
      return;
    }

    const foundExistingFile = await tryOpenExistingOutputFile(outputsDir, conversion);

    if (!foundExistingFile) {
      await createAndOpenDefaultOutputFile(outputsDir, conversion);
    }
  } catch {
    await createAndOpenDefaultOutputFile(outputsDir, conversion);
  }
}

/**
 * Attempts to open files from the lastShownOutputFiles list.
 * @param conversion - The conversion item
 * @returns True if files were successfully opened, false otherwise
 */
async function tryOpenLastShownOutputFiles(conversion: ConversionItem): Promise<boolean> {
  if (!conversion.lastShownOutputFiles || conversion.lastShownOutputFiles.length === 0) {
    return false;
  }

  for (const outputFilePath of conversion.lastShownOutputFiles) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(outputFilePath));
      const outputDocument = await vscode.workspace.openTextDocument(outputFilePath);
      await vscode.window.showTextDocument(outputDocument, {
        viewColumn: vscode.ViewColumn.Three,
        preserveFocus: true,
        preview: false,
      });
    } catch (error) {
      console.warn(
        `Could not open last shown output file ${outputFilePath}:`,
        error,
      );
    }
  }
  return true;
}

/**
 * Attempts to open the first existing output file found in the outputs directory.
 * @param outputsDir - The outputs directory URI
 * @param conversion - The conversion item
 * @returns True if an existing file was found and opened, false otherwise
 */
async function tryOpenExistingOutputFile(
  outputsDir: vscode.Uri,
  conversion: ConversionItem,
): Promise<boolean> {
  const entries = await vscode.workspace.fs.readDirectory(outputsDir);

  for (const [fileName, fileType] of entries) {
    if (fileType === vscode.FileType.File) {
      const outputPath = vscode.Uri.joinPath(outputsDir, fileName);
      await ensureFileExists(outputPath, getDefaultOutputContent(conversion.name));

      const outputDocument = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(
        outputDocument,
        {
          viewColumn: vscode.ViewColumn.Three,
          preserveFocus: true,
          preview: false,
        }
      );

      conversion.outputFilePath = outputPath.fsPath;
      return true; // Only open the first output file found
    }
  }
  return false;
}

/**
 * Creates and opens a default output file.
 * @param outputsDir - The outputs directory URI
 * @param conversion - The conversion item
 */
async function createAndOpenDefaultOutputFile(
  outputsDir: vscode.Uri,
  conversion: ConversionItem,
): Promise<void> {
  const fileExtension = getOutputFileExtension(conversion);
  const outputPath = vscode.Uri.joinPath(outputsDir, `output${fileExtension}`);
  await ensureFileExists(outputPath, getDefaultOutputContent(conversion.name));

  const outputDocument = await vscode.workspace.openTextDocument(outputPath);
  await vscode.window.showTextDocument(
    outputDocument,
    {
      viewColumn: vscode.ViewColumn.Three,
      preserveFocus: true,
      preview: false,
    }
  );

  conversion.outputFilePath = outputPath.fsPath;
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
    registerSelectRdfSerialization(csvwActionsProvider),
    registerToggleTemplateIRIs(csvwActionsProvider),
    registerToggleMinimalMode(csvwActionsProvider),
    registerClearRedUnderlines(),
    registerConvertCurrentWindow(csvwActionsProvider),
  );
}
