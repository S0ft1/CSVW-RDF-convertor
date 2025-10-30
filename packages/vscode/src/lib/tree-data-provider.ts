import * as vscode from 'vscode';
import { Conversion, TreeItem, isSimpleItem } from './types.js';
import {
  RDFSerialization,
  serializationLabels,
} from '@csvw-rdf-convertor/core';
import { CREATE_CONVERSION_COMMAND } from './commands/create-conversion.js';
import { TOGGLE_MINIMAL_MODE_COMMAND } from './commands/toggle-minimal-mode.js';
import { TOGGLE_TEMPLATE_IRIS_COMMAND } from './commands/toggle-template-iris.js';
import { SELECT_RDF_SERIALIZATION_COMMAND } from './commands/select-rdf-serialization.js';

const CONVERSIONS_STATE_KEY = 'csvw-rdf-conversions';
const COUNTER_STATE_KEY = 'csvw-rdf-conversion-counter';

/**
 * Tree data provider for the CSVW Actions view in VS Code.
 * Manages the display and interaction with conversion items in the tree view.
 */
export class CSVWActionsProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | null | void
  > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;
  private counter: number;
  private conversions: Conversion[];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadWorkspaceState();
  }

  /**
   * Loads existing conversions and conversions counter from the workspace state.
   */
  private loadWorkspaceState(): void {
    this.counter =
      this.context.workspaceState.get<number>(COUNTER_STATE_KEY) ?? 1;

    this.conversions =
      this.context.workspaceState.get<Conversion[]>(CONVERSIONS_STATE_KEY) ??
      [];

    this.refresh();

    vscode.window.showInformationMessage(
      `📁 Loaded ${this.conversions.length} existing conversion(s)`,
    );
  }

  /**
   * Refreshes the tree view to reflect any changes in the data.
   */
  refresh(): void {
    this.context.workspaceState.update(COUNTER_STATE_KEY, this.counter);
    this.context.workspaceState.update(CONVERSIONS_STATE_KEY, this.conversions);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Creates and adds a new conversion item to the tree view.
   * @param name Name of the conversion that will be displayed in the tree view
   * @param descriptorFilePath URI of the descriptor file
   * @param csvFilePaths URIs of csv files in an array
   * @param rdfFilePaths URIs of rdf files in multiple serilizations
   * @returns The newly created conversion item.
   */
  addConversion(
    name: string,
    descriptorFilePath: vscode.Uri,
    csvFilePaths: [vscode.Uri, ...vscode.Uri[]],
    rdfFilePaths: Partial<Record<RDFSerialization, vscode.Uri>>,
  ): Conversion {
    const conversion: Conversion = {
      conversionId: `conversion-${this.counter}`,
      conversionName: name,
      descriptorFilePath: descriptorFilePath,
      csvFilePaths: csvFilePaths,
      rdfFilePaths: rdfFilePaths,
      rdfSerialization: 'turtle',
      templateIRIs: true,
      minimalMode: true,
    };

    this.conversions.push(conversion);
    this.counter++;
    this.refresh();

    return conversion;
  }

  /**
   * Removes a conversion item from the tree view.
   * @param id - The ID of the conversion to remove.
   */
  removeConversion(id: string): void {
    this.conversions = this.conversions.filter((c) => c.conversionId !== id);
    this.refresh();
  }

  /**
   * Retrieves a conversion item by its ID.
   * @param id - The ID of the conversion to retrieve.
   * @returns The conversion item if found, undefined otherwise.
   */
  getConversion(id: string): Conversion | undefined {
    return this.conversions.find((c) => c.conversionId === id);
  }

  /**
   * Gets all conversion items.
   * @returns Array of all conversion items.
   */
  getAllConversions(): Conversion[] {
    return this.conversions;
  }

  /**
   * Gets the children of a tree item for hierarchical display.
   * @param element - The parent element to get children for. If undefined, returns root items.
   * @returns Promise resolving to an array of child tree items.
   */
  getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.at(0);
      if (workspaceFolder === undefined) {
        return [
          {
            label: 'No workspace folder open',
            iconPath: new vscode.ThemeIcon(
              'error',
              new vscode.ThemeColor('errorForeground'),
            ),
          },
        ];
      } else {
        return [
          {
            label: 'Create Conversion',
            iconPath: new vscode.ThemeIcon('add'),
            command: {
              title: 'Create Conversion',
              command: CREATE_CONVERSION_COMMAND,
              arguments: [workspaceFolder.uri],
            },
          },
          {
            label: 'Convert Current Window',
            iconPath: new vscode.ThemeIcon('arrow-right'),
          },
          ...this.conversions,
        ];
      }
    } else if (isSimpleItem(element)) {
      return [];
    } else {
      return [
        {
          conversion: element,
          label: 'Open Fields',
          iconPath: new vscode.ThemeIcon('chrome-restore'),
        },
        {
          conversion: element,
          label: 'Close Fields',
          iconPath: new vscode.ThemeIcon('close-all'),
        },
        {
          conversion: element,
          label: 'Convert CSVW 🡢 RDF',
          iconPath: new vscode.ThemeIcon('arrow-right'),
        },
        {
          conversion: element,
          label: 'Convert RDF 🡢 CSVW',
          iconPath: new vscode.ThemeIcon('arrow-left'),
        },
        {
          conversion: element,
          label: 'Validate',
          iconPath: new vscode.ThemeIcon('check'),
        },
        {
          conversion: element,
          label: 'Add another input',
          iconPath: new vscode.ThemeIcon('new-file'),
        },
        {
          conversion: element,
          label: 'RDF Serialization:',
          iconPath: new vscode.ThemeIcon('file-code'),
          command: {
            command: SELECT_RDF_SERIALIZATION_COMMAND,
            title: 'Select RDF Serialization',
            arguments: [element],
          },
          description: `${serializationLabels[element.rdfSerialization]} ⌵`,
          tooltip: `RDF Serialization: ${serializationLabels[element.rdfSerialization]}`,
        },
        {
          conversion: element,
          label: 'Template IRIs',
          iconPath: new vscode.ThemeIcon(
            element.templateIRIs ? 'pass-filled' : 'circle-large-outline',
            element.templateIRIs
              ? new vscode.ThemeColor('testing.iconPassed')
              : new vscode.ThemeColor('testing.iconQueued'),
          ),
          command: {
            command: TOGGLE_TEMPLATE_IRIS_COMMAND,
            title: 'Toggle Template IRIs',
            arguments: [element],
          },
          tooltip: element.templateIRIs
            ? 'Template IRIs enabled'
            : 'Template IRIs disabled',
        },
        {
          conversion: element,
          label: 'Minimal Mode',
          iconPath: new vscode.ThemeIcon(
            element.minimalMode ? 'pass-filled' : 'circle-large-outline',
            element.minimalMode
              ? new vscode.ThemeColor('testing.iconPassed')
              : new vscode.ThemeColor('testing.iconQueued'),
          ),
          command: {
            command: TOGGLE_MINIMAL_MODE_COMMAND,
            title: 'Toggle Minimal Mode',
            arguments: [element],
          },
          tooltip: element.minimalMode
            ? 'Minimal Mode enabled'
            : 'Minimal Mode disabled',
        },
      ];
    }
  }

  /**
   * Gets the parent of a tree item for navigation purposes.
   * @param element - The element to get the parent for.
   * @returns The parent tree item or undefined if no parent exists.
   */
  getParent(element: TreeItem): vscode.ProviderResult<TreeItem | undefined> {
    if (isSimpleItem(element)) {
      return element.conversion;
    } else {
      return undefined;
    }
  }

  /**
   * Creates a tree item representation for display in the VS Code tree view.
   * @param element - The element to create a tree item for.
   * @returns A VS Code tree item configured for display.
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    if (isSimpleItem(element)) {
      return element;
    } else {
      const item = new vscode.TreeItem(
        element.conversionName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'conversion';
      item.id = element.conversionId;
      return item;
    }
  }
