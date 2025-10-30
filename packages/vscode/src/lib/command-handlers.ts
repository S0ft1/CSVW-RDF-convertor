import * as vscode from 'vscode';
import { CSVWActionsProvider } from './tree-data-provider.js';
import {
  registerCreateConversion,
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
  registerSaveListener,
} from './commands/index.js';

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
    registerCreateConversion(csvwActionsProvider),
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
    registerSaveListener(csvwActionsProvider),
  );
}
