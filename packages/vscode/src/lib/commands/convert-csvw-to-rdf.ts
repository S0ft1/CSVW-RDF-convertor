import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { convertCSVW2RDF } from '../conversion-logic.js';
import { ConversionItem, MiniOptions } from '../types.js';
import {
  validateConversionExists,
  ensureConversionPaths,
  readDescriptorContent,
  updateConversionState,
  openOutputFiles,
  handleConversionError,
} from '../conversion-utils.js';

/**
 * Gets the conversion options from the conversion item
 * @param conversion - The conversion item containing template and minimal mode settings
 * @returns Object with templateIris and minimal boolean flags
 */
async function getConversionOptions(
  conversion: ConversionItem,
): Promise<MiniOptions> {
  return {
    rdfSerialization: conversion.rdfSerialization ?? 'turtle',
    templateIris: conversion.templateIRIsChecked ?? true,
    minimal: conversion.minimalModeChecked ?? true,
  };
}

/**
 * Performs the CSVW to RDF conversion process
 * @param conversion - The conversion item to process
 */
async function performCsvwToRdfConversion(
  conversion: ConversionItem,
): Promise<void> {
  ensureConversionPaths(conversion);

  const descriptorContent = await readDescriptorContent(conversion);
  const conversionOptions = await getConversionOptions(conversion);

  const outputFilePaths = await convertCSVW2RDF(
    descriptorContent,
    conversionOptions,
    conversion,
  );

  updateConversionState(conversion, outputFilePaths);
  await openOutputFiles(outputFilePaths);

  vscode.window.showInformationMessage(
    `✅ CSVW→RDF conversion completed for: ${conversion.name}`,
  );
}

/**
 * Registers the CSVW to RDF conversion command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable for the registered command
 */
export function registerConvertCsvwToRdf(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'csvwrdfconvertor.convertCsvwToRdf',
    async (conversionId: string) => {
      const conversion = csvwActionsProvider.getConversion(conversionId);
      if (!validateConversionExists(conversion)) {
        return;
      }

      try {
        await performCsvwToRdfConversion(conversion);
      } catch (error) {
        await handleConversionError(conversion, error, 'CSVW→RDF');
      }
    },
  );
}
