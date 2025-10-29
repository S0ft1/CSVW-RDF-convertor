import * as vscode from 'vscode';
import { CSVWActionsProvider } from './lib/tree-data-provider.js';
import { registerCommands } from './lib/command-handlers.js';

export async function activate(context: vscode.ExtensionContext) {
  console.log('CSVW to RDF Convertor activated');
  const csvwActionsProvider = new CSVWActionsProvider(context);

  vscode.window.createTreeView('csvw-rdf-actions', {
    treeDataProvider: csvwActionsProvider,
    canSelectMany: false,
    showCollapseAll: true,
  });

  vscode.commands.registerCommand(
    'csvwrdfconvertor.refreshActions',
    csvwActionsProvider.refresh,
  );

  registerCommands(context, csvwActionsProvider);
}
export function deactivate() {}
