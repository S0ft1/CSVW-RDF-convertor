import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { validateConversionExists } from '../conversion-utils.js';
import {
  RDFSerialization,
  serializationLabels,
} from '@csvw-rdf-convertor/core';

class RDFSerializationItem implements vscode.QuickPickItem {
  serialization: RDFSerialization;
  label: string;

  constructor(serialization: RDFSerialization) {
    this.serialization = serialization;
    this.label = serializationLabels[this.serialization];
  }
}

export function registerSelectRdfSerialization(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'csvwrdfconvertor.selectRdfSerialization',
    async (conversionId: string) => {
      const conversion = csvwActionsProvider.getConversion(conversionId);
      if (!validateConversionExists(conversion)) {
        return;
      }

      const selectedFormat =
        await vscode.window.showQuickPick<RDFSerializationItem>([
          new RDFSerializationItem('turtle'),
          new RDFSerializationItem('ntriples'),
          new RDFSerializationItem('nquads'),
          new RDFSerializationItem('trig'),
          new RDFSerializationItem('jsonld'),
        ]);

      if (selectedFormat !== undefined)
        conversion.rdfSerialization = selectedFormat.serialization;

      csvwActionsProvider.refresh();
    },
  );
}
