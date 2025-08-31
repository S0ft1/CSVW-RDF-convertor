import * as vscode from 'vscode';
import { ConversionItem } from '../types.js';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { addRedUnderlineToLines, clearRedUnderlines } from '../editor-utils.js';
import {
  Csvw2RdfOptions,
  Issue,
  validateCsvwFromDescriptor,
} from '@csvw-rdf-convertor/core';
import * as path from 'path';

import { getCSVWOptions } from '../conversion-logic.js';
/**
 * Validates the descriptor document for a conversion.
 * Performs JSON syntax validation and highlights errors with red underlines in the editor.
 * @param conversion - The conversion item whose descriptor should be validated
 */
async function validateDocument(conversion: ConversionItem) {
  const descriptorEditor = vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.fsPath === conversion.descriptorFilePath,
  );

  if (!descriptorEditor) {
    vscode.window.showWarningMessage(
      `Please open the descriptor file for "${conversion.name}" first`,
    );
    return;
  }
  const inputsDir = path.join(conversion.folderPath, 'inputs');
  const csvw2RdfOptions: Csvw2RdfOptions = getCSVWOptions(
    { minimal: false, templateIris: false },
    inputsDir,
  );
  clearRedUnderlines(descriptorEditor);
  const content = descriptorEditor.document.getText();
  const errorMessages: string[] = [];
  let errorList: AsyncIterable<Issue> | null = null;
  try {
    errorList = validateCsvwFromDescriptor(content, csvw2RdfOptions);
    if (errorList) {
      for await (const error of errorList) {
        errorMessages.push(`${error.type.toUpperCase()}: ${error.message}}`);
      }
    }
  } catch (error) {
    errorMessages.push(`ERROR: ${(error as Error).message}`);
  } finally {
    addRedUnderlineToLines(descriptorEditor, errorMessages);
    if (errorMessages.length === 0) {
      vscode.window.showInformationMessage(
        `✅ Validation complete for "${conversion.name}". Descriptor is valid!`,
      );
    } else {
      vscode.window.showInformationMessage(
        `🔍 Validation complete for "${conversion.name}". Found ${errorMessages.length} issues.`,
      );
    }
  }
}

/**
 * Validates a specific conversion's descriptor
 */
export function registerValidateSpecific(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'csvwrdfconvertor.validateSpecific',
    async (conversionId: string) => {
      const conversion = csvwActionsProvider.getConversion(conversionId);
      if (!conversion) {
        vscode.window.showErrorMessage('❌ Conversion not found');
        return;
      }

      if (!conversion.descriptorFilePath) {
        vscode.window.showWarningMessage(
          `Please open fields for "${conversion.name}" first`,
        );
        return;
      }
      validateDocument(conversion);
    },
  );
}
