import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import {
  RDFSerialization,
  serializationLabels,
} from '@csvw-rdf-convertor/core';
import { ConversionItem } from '../types.js';

export const SELECT_RDF_SERIALIZATION_COMMAND =
  'csvwrdfconvertor.selectRdfSerialization';

class RDFSerializationItem implements vscode.QuickPickItem {
  serialization: RDFSerialization;
  label: string;

  constructor(serialization: RDFSerialization) {
    this.serialization = serialization;
    this.label = serializationLabels[this.serialization];
  }
}

/**
 * Registers the command for RDF serialization selection
 * @param csvwActionsProvider The tree data provider for conversions
 * @returns Disposable which unregisters the command on disposal
 */
export function registerSelectRdfSerialization(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    SELECT_RDF_SERIALIZATION_COMMAND,
    async (conversion: ConversionItem) => {
      const selectedFormat =
        await vscode.window.showQuickPick<RDFSerializationItem>([
          new RDFSerializationItem('turtle'),
          new RDFSerializationItem('ntriples'),
          new RDFSerializationItem('nquads'),
          new RDFSerializationItem('trig'),
          new RDFSerializationItem('jsonld'),
        ]);

      if (selectedFormat !== undefined) {
        conversion.rdfSerialization = selectedFormat.serialization;
        csvwActionsProvider.refresh();
      }
    },
  );
}
