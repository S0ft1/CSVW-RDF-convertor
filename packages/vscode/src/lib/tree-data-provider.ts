import * as vscode from 'vscode';
import { ConversionItem, TreeItem } from './types.js';
import {
  RDFSerialization,
  serializationLabels,
} from '@csvw-rdf-convertor/core';
import { CREATE_CONVERSION_COMMAND } from './commands/add-new-conversion.js';

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
  private conversions: ConversionItem[];

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
      this.context.workspaceState.get<ConversionItem[]>(
        CONVERSIONS_STATE_KEY,
      ) ?? [];

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
  ): ConversionItem {
    const conversion: ConversionItem = {
      id: `conversion-${this.counter}`,
      name: name,
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
    this.conversions = this.conversions.filter((c) => c.id !== id);
    this.refresh();
  }

  /**
   * Retrieves a conversion item by its ID.
   * @param id - The ID of the conversion to retrieve.
   * @returns The conversion item if found, undefined otherwise.
   */
  getConversion(id: string): ConversionItem | undefined {
    return this.conversions.find((c) => c.id === id);
  }

  /**
   * Gets all conversion items.
   * @returns Array of all conversion items.
   */
  getAllConversions(): ConversionItem[] {
    return this.conversions;
  }

  /**
   * Creates a tree item representation for display in the VS Code tree view.
   * @param element - The element to create a tree item for.
   * @returns A VS Code tree item configured for display.
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    if (typeof element === 'string') {
      if (element.includes(':')) {
        return this.createActionTreeItem(element);
      } else {
        const item = new vscode.TreeItem(
          element,
          vscode.TreeItemCollapsibleState.None,
        );

        switch (element) {
          case 'Add Conversion':
            item.command = {
              command: CREATE_CONVERSION_COMMAND,
              title: 'Add New Conversion',
            };
            item.iconPath = new vscode.ThemeIcon('add');
            break;
          case 'Convert Current Window':
            item.command = {
              command: 'csvwrdfconvertor.convertCurrentWindow',
              title: 'Convert Current Window',
            };
            item.iconPath = new vscode.ThemeIcon('arrow-right');
            break;
        }

        return item;
      }
    } else {
      const item = new vscode.TreeItem(
        element.name,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon('folder');
      item.contextValue = 'conversion';
      item.id = element.id;
      return item;
    }
  }

  /**
   * Gets the children of a tree item for hierarchical display.
   * @param element - The parent element to get children for. If undefined, returns root items.
   * @returns Promise resolving to an array of child tree items.
   */
  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      const mainActions = ['Add Conversion', 'Convert Current Window'];
      return Promise.resolve([...mainActions, ...this.conversions]);
    } else if (typeof element !== 'string') {
      const conversionActions = [
        `${element.id}:Open Fields`,
        `${element.id}:Close Fields`,
        `${element.id}:Convert CSVW 🡢 RDF`,
        `${element.id}:Convert RDF 🡢 CSVW`,
        `${element.id}:Validate`,
        `${element.id}:Add another input`,
        `${element.id}:Output RDF Serialization`,
        `${element.id}:Template IRIs`,
        `${element.id}:Minimal Mode`,
      ];
      return Promise.resolve(conversionActions);
    }
    return Promise.resolve([]);
  }

  /**
   * Gets the parent of a tree item for navigation purposes.
   * @param element - The element to get the parent for.
   * @returns The parent tree item or null if no parent exists.
   */
  getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
    if (typeof element === 'string' && element.includes(':')) {
      const conversionId = element.split(':')[0];
      return this.getConversion(conversionId);
    }
    return null;
  }

  /**
   * Creates a tree item for conversion actions with appropriate commands and icons.
   * @param action - The action string in format "conversionId:actionName".
   * @returns A configured tree item for the specific action.
   */
  createActionTreeItem(action: string): vscode.TreeItem {
    const [conversionId, actionName] = action.split(':');
    const item = new vscode.TreeItem(
      actionName,
      vscode.TreeItemCollapsibleState.None,
    );

    switch (actionName) {
      case 'Open Fields':
        item.command = {
          command: 'csvwrdfconvertor.openConversionFields',
          title: 'Open Fields',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('chrome-restore');
        break;
      case 'Close Fields':
        item.command = {
          command: 'csvwrdfconvertor.closeConversionFields',
          title: 'Close Fields',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('close-all');
        break;
      case 'Convert CSVW 🡢 RDF':
        item.command = {
          command: 'csvwrdfconvertor.convertCsvwToRdf',
          title: 'Convert CSVW 🡢 RDF',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('arrow-right');
        break;
      case 'Convert RDF 🡢 CSVW':
        item.command = {
          command: 'csvwrdfconvertor.convertRdfToCsvw',
          title: 'Convert RDF 🡢 CSVW',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('arrow-left');
        break;
      case 'Validate':
        item.command = {
          command: 'csvwrdfconvertor.validateSpecific',
          title: 'Validate',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('check');
        break;
      case 'Add another input':
        item.command = {
          command: 'csvwrdfconvertor.addAnotherInput',
          title: 'Add another input',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('new-file');
        break;
      case 'Output RDF Serialization': {
        const conversion = this.getConversion(conversionId);
        const selectedRdfSerialization =
          conversion?.rdfSerialization ?? 'turtle';
        item.command = {
          command: 'csvwrdfconvertor.selectRdfSerialization',
          title: 'Output RDF Serialization',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('file-code');
        item.label = 'RDF Serialization:';
        item.description = `${serializationLabels[selectedRdfSerialization]} ⌵`;
        item.tooltip = `RDF Serialization: ${serializationLabels[selectedRdfSerialization]}`;
        break;
      }
      case 'Template IRIs': {
        const conversion = this.getConversion(conversionId);
        const templateIRIsChecked = conversion?.templateIRIs ?? false;
        item.command = {
          command: 'csvwrdfconvertor.toggleTemplateIRIs',
          title: 'Toggle Template IRIs',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon(
          templateIRIsChecked ? 'pass-filled' : 'circle-large-outline',
          templateIRIsChecked
            ? new vscode.ThemeColor('testing.iconPassed')
            : new vscode.ThemeColor('testing.iconQueued'),
        );
        item.label = `Template IRIs`;
        item.tooltip = templateIRIsChecked
          ? 'Template IRIs enabled - Click to disable'
          : 'Template IRIs disabled - Click to enable';
        break;
      }
      case 'Minimal Mode': {
        const conv = this.getConversion(conversionId);
        const minimalModeChecked = conv?.minimalMode ?? false;
        item.command = {
          command: 'csvwrdfconvertor.toggleMinimalMode',
          title: 'Toggle Minimal Mode',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon(
          minimalModeChecked ? 'pass-filled' : 'circle-large-outline',
          minimalModeChecked
            ? new vscode.ThemeColor('testing.iconPassed')
            : new vscode.ThemeColor('testing.iconQueued'),
        );
        item.label = `Minimal Mode`;
        item.tooltip = minimalModeChecked
          ? 'Minimal Mode enabled - Click to disable'
          : 'Minimal Mode disabled - Click to enable';
        break;
      }
    }

    return item;
  }
}
