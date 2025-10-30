import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { Conversion } from '../types.js';

export const TOGGLE_TEMPLATE_IRIS_COMMAND =
  'csvwrdfconvertor.toggleTemplateIRIs';

/**
 * Registers the toggle Template IRIs command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable which unregisters the command on disposal
 */
export function registerToggleTemplateIRIs(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    TOGGLE_TEMPLATE_IRIS_COMMAND,
    async (conversion: Conversion) => {
      conversion.templateIRIs = !conversion.templateIRIs;
      csvwActionsProvider.refresh();
    },
  );
}
