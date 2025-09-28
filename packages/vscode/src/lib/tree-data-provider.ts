import * as vscode from 'vscode';
import { ConversionItem, TreeItem } from './types.js';
import {
  ensureFileExists,
  getDefaultDescriptorContent,
  getDefaultInputContent,
  getDefaultOutputContent,
  getDefaultRdfInputContent,
} from './file-utils.js';
import { createInputFilesFromDescriptor } from './command-handlers.js';

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

  private conversions: ConversionItem[] = [];
  public conversionCounter = 1;

  /**
   * Refreshes the tree view to reflect any changes in the data.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Adds a new conversion item to the tree view.
   * @param name - Optional name for the conversion. If not provided, a default name will be generated.
   * @returns The newly created conversion item.
   */
  addConversion(name?: string): ConversionItem {
    const conversionName = name || `Conversion ${this.conversionCounter}`;
    const conversion: ConversionItem = {
      id: `conversion-${this.conversionCounter}`,
      name: conversionName,
      folderPath: '',
      inputFilePath: '',
      rdfInputFilePath: '',
    };
    this.conversions.push(conversion);
    this.conversionCounter++;
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
              command: 'csvwrdfconvertor.addNewConversion',
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
        `${element.id}:Add another input`,
        `${element.id}:Validate`,
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
        item.iconPath = new vscode.ThemeIcon('split-horizontal');
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
      case 'Add another input':
        item.command = {
          command: 'csvwrdfconvertor.addAnotherInput',
          title: 'Add another input',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('add');
        break;
      case 'Validate':
        item.command = {
          command: 'csvwrdfconvertor.validateSpecific',
          title: 'Validate',
          arguments: [conversionId],
        };
        item.iconPath = new vscode.ThemeIcon('check');
        break;
      case 'Template IRIs': {
        const conversion = this.getConversion(conversionId);
        const templateIRIsChecked = conversion?.templateIRIsChecked ?? false;
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
        const minimalModeChecked = conv?.minimalModeChecked ?? false;
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

/**
 * Validates workspace availability for loading conversions.
 * @returns The workspace root path or null if no workspace is available
 */
function validateWorkspace(): string | null {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    return null;
  }
  return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

/**
 * Ensures required directories exist for a conversion.
 * Creates inputs and outputs directories if they don't exist.
 * @param conversionDir - The main conversion directory URI
 * @returns Promise resolving to inputs and outputs directory URIs
 */
async function ensureConversionDirectories(conversionDir: vscode.Uri): Promise<{
  inputsDir: vscode.Uri;
  outputsDir: vscode.Uri;
}> {
  const inputsDir = vscode.Uri.joinPath(conversionDir, 'inputs');
  const outputsDir = vscode.Uri.joinPath(conversionDir, 'outputs');

  try {
    await vscode.workspace.fs.createDirectory(inputsDir);
    await vscode.workspace.fs.createDirectory(outputsDir);
  } catch {
    // Directories might already exist
  }

  return { inputsDir, outputsDir };
}

/**
 * Sets up the descriptor file for a conversion.
 * Ensures the descriptor exists and returns its content.
 * @param conversionDir - The main conversion directory URI
 * @param conversion - The conversion item to update with descriptor path
 * @returns Promise resolving to the descriptor content as text
 */
async function setupDescriptorFile(
  conversionDir: vscode.Uri,
  conversion: ConversionItem,
): Promise<string> {
  const descriptorPath = vscode.Uri.joinPath(
    conversionDir,
    'descriptor.jsonld',
  );
  conversion.descriptorFilePath = descriptorPath.fsPath;

  await ensureFileExists(descriptorPath, getDefaultDescriptorContent());

  const descriptorBytes = await vscode.workspace.fs.readFile(descriptorPath);
  return new TextDecoder().decode(descriptorBytes);
}

/**
 * Creates input files for a conversion based on descriptor content.
 * Handles both descriptor-based and fallback input file creation.
 * @param inputsDir - The inputs directory URI
 * @param conversion - The conversion item to update with input file paths
 * @param descriptorText - The descriptor content to parse for table URLs
 * @param conversionName - The name of the conversion for fallback file creation
 */
async function createConversionInputFiles(
  inputsDir: vscode.Uri,
  conversion: ConversionItem,
  descriptorText: string,
  conversionName: string,
): Promise<void> {
  try {
    await createInputFilesFromDescriptor(inputsDir, conversion, descriptorText);
  } catch (error) {
    console.warn(
      `Could not create input files from descriptor for ${conversionName}:`,
      error,
    );
    const fallbackInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
    await ensureFileExists(fallbackInputPath, getDefaultInputContent());
    conversion.inputFilePath = fallbackInputPath.fsPath;
  }

  const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
  await ensureFileExists(rdfInputPath, getDefaultRdfInputContent());
  conversion.rdfInputFilePath = rdfInputPath.fsPath;
}

/**
 * Sets up output files for a conversion.
 * Ensures the default output file exists.
 * @param outputsDir - The outputs directory URI
 * @param conversion - The conversion item to update with output file path
 * @param conversionName - The name of the conversion for output file content
 */
async function setupOutputFiles(
  outputsDir: vscode.Uri,
  conversion: ConversionItem,
  conversionName: string,
): Promise<void> {
  const outputPath = vscode.Uri.joinPath(outputsDir, 'output.ttl');
  conversion.outputFilePath = outputPath.fsPath;
  await ensureFileExists(outputPath, getDefaultOutputContent(conversionName));
}

/**
 * Processes a single conversion directory and creates a conversion item.
 * Handles all aspects of conversion setup including directories, files, and configuration.
 * @param provider - The tree data provider to add the conversion to
 * @param extensionDir - The main extensions directory URI
 * @param conversionName - The name of the conversion directory
 */
async function processConversionDirectory(
  provider: CSVWActionsProvider,
  extensionDir: vscode.Uri,
  conversionName: string,
): Promise<void> {
  const conversionDir = vscode.Uri.joinPath(extensionDir, conversionName);
  const conversion = provider.addConversion(conversionName);
  conversion.folderPath = conversionDir.fsPath;

  const { inputsDir, outputsDir } =
    await ensureConversionDirectories(conversionDir);
  const descriptorText = await setupDescriptorFile(conversionDir, conversion);
  await createConversionInputFiles(
    inputsDir,
    conversion,
    descriptorText,
    conversionName,
  );
  await setupOutputFiles(outputsDir, conversion, conversionName);
}

/**
 * Shows success message after loading conversions.
 * @param directoryCount - Number of conversion directories found
 */
function showLoadingResult(directoryCount: number): void {
  if (directoryCount > 0) {
    vscode.window.showInformationMessage(
      `📁 Loaded ${directoryCount} existing conversion(s)`,
    );
  }
}

/**
 * Loads existing conversions from the workspace and populates the tree view.
 * Scans the csvw-rdf-conversions directory for existing conversion folders and sets up each conversion.
 * @param provider - The tree data provider to populate with existing conversions
 */
export async function loadExistingConversions(
  provider: CSVWActionsProvider,
): Promise<void> {
  const workspaceRoot = validateWorkspace();
  if (!workspaceRoot) return;

  const extensionDir = vscode.Uri.joinPath(
    vscode.Uri.file(workspaceRoot),
    'csvw-rdf-conversions',
  );

  try {
    await vscode.workspace.fs.stat(extensionDir);
    const entries = await vscode.workspace.fs.readDirectory(extensionDir);

    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory) {
        await processConversionDirectory(provider, extensionDir, name);
      }
    }

    provider.refresh();
    const directoryCount = entries.filter(
      ([, type]) => type === vscode.FileType.Directory,
    ).length;
    showLoadingResult(directoryCount);
  } catch {
    // No existing conversions found - this is expected for new workspaces
  }
}
