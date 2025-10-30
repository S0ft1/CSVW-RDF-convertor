import * as vscode from 'vscode';
import { RDFSerialization } from '@csvw-rdf-convertor/core';

export interface SimpleItem extends vscode.TreeItem {
  conversion?: Conversion;
}

/**
 * Represents a single conversion item in the tree view.
 * Contains all necessary information and references for managing a conversion.
 */
export interface Conversion {
  readonly conversionId: string;
  conversionName: string;

  descriptorFilePath: vscode.Uri;
  csvFilePaths: [vscode.Uri, ...vscode.Uri[]];
  rdfFilePaths: Partial<Record<RDFSerialization, vscode.Uri>>;

  rdfSerialization: RDFSerialization;
  templateIRIs: boolean;
  minimalMode: boolean;
}

export function isSimpleItem(item: TreeItem): item is SimpleItem {
  return !('conversionId' in item);
}

/**
 * Union type representing items that can be displayed in the tree view.
 * Can be either a string (for actions) or a ConversionItem.
 */
export type TreeItem = SimpleItem | Conversion;
