import * as vscode from 'vscode';
import { CSVWActionsProvider } from './tree-data-provider.js';
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
    registerSaveListener(csvwActionsProvider),
  );
}

/**
 * Validates that a workspace is open.
 * @returns first opened workspace if valid, undefined otherwise
 */
export function validateWorkspace(): vscode.WorkspaceFolder | undefined {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage(
      '❌ No workspace folder open. Please open a folder first.',
    );
    return undefined;
  }
  return vscode.workspace.workspaceFolders[0];
}
