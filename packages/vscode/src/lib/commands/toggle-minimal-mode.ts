import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { ConversionItem } from '../types.js';

export const TOGGLE_MINIMAL_MODE_COMMAND = 'csvwrdfconvertor.toggleMinimalMode';

/**
 * Registers the toggle Minimal Mode command
 * @param csvwActionsProvider - The tree data provider for conversions
 * @returns Disposable which unregisters the command on disposal
 */
export function registerToggleMinimalMode(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    TOGGLE_MINIMAL_MODE_COMMAND,
    async (conversion: ConversionItem) => {
      conversion.minimalMode = !conversion.minimalMode;
      csvwActionsProvider.refresh();
    },
  );
}
