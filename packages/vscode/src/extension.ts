import * as vscode from 'vscode';
import {
  CSVWActionsProvider,
  loadExistingConversions,
} from './lib/tree-data-provider.js';
import { registerCommands } from './lib/command-handlers.js';
import { registerSaveListener } from './lib/commands/index.js';

export async function activate(context: vscode.ExtensionContext) {
  console.log('CSVW to RDF Convertor activated');
  const csvwActionsProvider = new CSVWActionsProvider();

  vscode.window.createTreeView('csvw-rdf-actions', {
    treeDataProvider: csvwActionsProvider,
    canSelectMany: false,
    showCollapseAll: true,
  });

  vscode.commands.registerCommand(
    'csvwrdfconvertor.refreshActions',
    csvwActionsProvider.refresh,
  );

  await loadExistingConversions(csvwActionsProvider);

  registerCommands(context, csvwActionsProvider);

  const saveListener = registerSaveListener(csvwActionsProvider);
  context.subscriptions.push(saveListener);
}
export function deactivate() {}
