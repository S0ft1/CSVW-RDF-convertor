import * as vscode from 'vscode';
import { ConversionItem, TreeItem, ConversionType } from './types.js';
import { ensureFileExists, getDefaultDescriptorContent, getDefaultInputContent, getDefaultOutputContent, getDefaultRdfInputContent } from './file-utils.js';
import { createInputFilesFromDescriptor } from './command-handlers.js';

/**
 * Tree data provider for the CSVW Actions view in VS Code.
 * Manages the display and interaction with conversion items in the tree view.
 */
export class CSVWActionsProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

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
		this.conversions = this.conversions.filter(c => c.id !== id);
		this.refresh();
	}

	/**
	 * Retrieves a conversion item by its ID.
	 * @param id - The ID of the conversion to retrieve.
	 * @returns The conversion item if found, undefined otherwise.
	 */
	getConversion(id: string): ConversionItem | undefined {
		return this.conversions.find(c => c.id === id);
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
				const item = new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);

				switch (element) {
					case 'Add Conversion':
						item.command = { command: 'csvwrdfconvertor.addNewConversion', title: 'Add New Conversion' };
						item.iconPath = new vscode.ThemeIcon('add');
						break;
					case 'Convert Current Window':
						item.command = { command: 'csvwrdfconvertor.convertCurrentWindow', title: 'Convert Current Window' };
						item.iconPath = new vscode.ThemeIcon('arrow-right');
						break;
				}

				return item;
			}
		} else {
			const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
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
				`${element.id}:Convert CSVW->RDF`,
				`${element.id}:Convert RDF->CSVW`,
				`${element.id}:Add another input`,
				`${element.id}:Validate`,
				`${element.id}:Template IRIs`,
				`${element.id}:Minimal Mode`
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
		const item = new vscode.TreeItem(actionName, vscode.TreeItemCollapsibleState.None);

		switch (actionName) {
			case 'Open Fields':
				item.command = { command: 'csvwrdfconvertor.openConversionFields', title: 'Open Fields', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('split-horizontal');
				break;
			case 'Close Fields':
				item.command = { command: 'csvwrdfconvertor.closeConversionFields', title: 'Close Fields', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('close-all');
				break;
			case 'Convert CSVW->RDF':
				item.command = { command: 'csvwrdfconvertor.convertCsvwToRdf', title: 'Convert CSVW->RDF', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('arrow-right');
				break;
			case 'Convert RDF->CSVW':
				item.command = { command: 'csvwrdfconvertor.convertRdfToCsvw', title: 'Convert RDF->CSVW', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('arrow-left');
				break;
			case 'Add another input':
				item.command = { command: 'csvwrdfconvertor.addAnotherInput', title: 'Add another input', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('add');
				break;
			case 'Validate':
				item.command = { command: 'csvwrdfconvertor.validateSpecific', title: 'Validate', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon('check');
				break;
			case 'Template IRIs':
				const conversion = this.getConversion(conversionId);
				const templateIRIsChecked = conversion?.templateIRIsChecked ?? false;
				item.command = { command: 'csvwrdfconvertor.toggleTemplateIRIs', title: 'Toggle Template IRIs', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon(
					templateIRIsChecked ? 'pass-filled' : 'circle-large-outline',
					templateIRIsChecked ? new vscode.ThemeColor('testing.iconPassed') : new vscode.ThemeColor('testing.iconQueued')
				);
				item.label = `Template IRIs`;
				item.tooltip = templateIRIsChecked ? 'Template IRIs enabled - Click to disable' : 'Template IRIs disabled - Click to enable';
				break;
			case 'Minimal Mode':
				const conv = this.getConversion(conversionId);
				const minimalModeChecked = conv?.minimalModeChecked ?? false;
				item.command = { command: 'csvwrdfconvertor.toggleMinimalMode', title: 'Toggle Minimal Mode', arguments: [conversionId] };
				item.iconPath = new vscode.ThemeIcon(
					minimalModeChecked ? 'pass-filled' : 'circle-large-outline',
					minimalModeChecked ? new vscode.ThemeColor('testing.iconPassed') : new vscode.ThemeColor('testing.iconQueued')
				);
				item.label = `Minimal Mode`;
				item.tooltip = minimalModeChecked ? 'Minimal Mode enabled - Click to disable' : 'Minimal Mode disabled - Click to enable';
				break;
		}

		return item;
	}
}

/**
 * Loads existing conversions from the workspace and populates the tree view.
 * Scans the csvw-rdf-conversions directory for existing conversion folders.
 * @param provider - The tree data provider to populate with existing conversions.
 */
export async function loadExistingConversions(provider: CSVWActionsProvider) {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		return; 
	}

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const extensionDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'csvw-rdf-conversions');

	try {
		await vscode.workspace.fs.stat(extensionDir);

		const entries = await vscode.workspace.fs.readDirectory(extensionDir);

		for (const [name, type] of entries) {
			if (type === vscode.FileType.Directory) {
				const conversionDir = vscode.Uri.joinPath(extensionDir, name);
				const inputsDir = vscode.Uri.joinPath(conversionDir, 'inputs');
				const outputsDir = vscode.Uri.joinPath(conversionDir, 'outputs');

				const conversion = provider.addConversion(name);
				conversion.folderPath = conversionDir.fsPath;

				const descriptorPath = vscode.Uri.joinPath(conversionDir, 'descriptor.jsonld');

				conversion.descriptorFilePath = descriptorPath.fsPath;

				// Ensure directories exist
				try {
					await vscode.workspace.fs.createDirectory(inputsDir);
					await vscode.workspace.fs.createDirectory(outputsDir);
				} catch {
					// Directories might already exist
				}

				// Ensure descriptor exists
				await ensureFileExists(descriptorPath, getDefaultDescriptorContent());

				// Read descriptor to create input files based on table URLs
				try {
					const descriptorBytes = await vscode.workspace.fs.readFile(descriptorPath);
					const descriptorText = new TextDecoder().decode(descriptorBytes);
					await createInputFilesFromDescriptor(inputsDir, conversion, descriptorText);
				} catch (error) {
					console.warn(`Could not create input files from descriptor for ${name}:`, error);
					// Fallback: create default csvInput.csv if descriptor parsing fails
					const fallbackInputPath = vscode.Uri.joinPath(inputsDir, 'csvInput.csv');
					await ensureFileExists(fallbackInputPath, getDefaultInputContent(name));
					conversion.inputFilePath = fallbackInputPath.fsPath;
				}

				// Always ensure rdfInput.ttl exists for potential RDF-to-CSV conversions
				const rdfInputPath = vscode.Uri.joinPath(inputsDir, 'rdfInput.ttl');
				await ensureFileExists(rdfInputPath, getDefaultRdfInputContent(name));
				conversion.rdfInputFilePath = rdfInputPath.fsPath;

				// Handle output files - check for existing output files
				const outputPath = vscode.Uri.joinPath(outputsDir, 'output.ttl');
				conversion.outputFilePath = outputPath.fsPath;
				await ensureFileExists(outputPath, getDefaultOutputContent(name));
			}
		}

		provider.refresh();

		if (entries.length > 0) {
			vscode.window.showInformationMessage(`📁 Loaded ${entries.filter(([, type]) => type === vscode.FileType.Directory).length} existing conversion(s)`);
		}

	} catch (error) {
		console.log('No existing conversions found');
	}
}
