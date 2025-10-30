import * as vscode from 'vscode';
import type { CSVWActionsProvider } from '../tree-data-provider.js';
import { ConversionItem } from '../types.js';

export const DELETE_CONVERSION_COMMAND = 'csvwrdfconvertor.deleteConversion';

/**
 * Registers the command that deletes a conversion.
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable which unregisters the command on disposal
 */
export function registerDeleteConversion(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    DELETE_CONVERSION_COMMAND,
    async (conversion: ConversionItem) => {
      const choice = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the conversion "${conversion.name}"?`,
        { modal: true },
        'Delete Conversion',
      );

      if (choice !== 'Delete Conversion') {
        return;
      }

      csvwActionsProvider.removeConversion(conversion.id);

      vscode.window.showInformationMessage(
        `✅ Deleted conversion: ${conversion.name}`,
      );
    },
  );
}
