# CSVW-RDF Convertor - VS Code Extension Developer Documentation

This document provides comprehensive technical documentation for developers working on or extending the CSVW-RDF Convertor VS Code extension.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Concepts](#key-concepts)
3. [Core Components](#core-components)
4. [Available Commands](#available-commands)
5. [Behaviour of non-trivial commands/listeners](#Behaviour-of-non-trivial-commands-and-listeners)
6. [Extension Activation](#extension-activation)
7. [Modules Documentation](#modules-documentation)

## Architecture Overview

The CSVW-RDF Convertor VS Code extension follows a modular, command-driven architecture that integrates with VS Code's extension API. The extension provides bidirectional conversion between CSVW (CSV on the Web) and RDF formats through an intuitive tree view interface and editor commands.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                   │
├─────────────────────────────────────────────────────────────┤
│  Extension Entry Point (index.ts)                           │
│  ├── Command Registration                                   │
│  ├── Tree Data Provider Registration                        │
│  └── Event Listeners Setup                                  │
├─────────────────────────────────────────────────────────────┤
│  Core Components                                            │
│  ├── Tree Data Provider (conversion management)             │
│  ├── Command Handlers (user actions)                        │
│  ├── Conversion Logic (CSVW ↔ RDF)                          │
│  ├── File Utilities (I/O operations)                        │
│  └── Editor Utilities (VS Code integration)                 │
├─────────────────────────────────────────────────────────────┤
│  External Dependencies                                      │
│  ├── @csvw-rdf-convertor/core (conversion engine)           │
│  ├── VS Code API (editor, workspace, UI)                    │
│  └── Node.js File System                                    │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Conversion Items
**Purpose**: Represents a single conversion configuration with input/output mappings.

```typescript
export interface ConversionItem {
	id: string;
	name: string;
	folderPath: string;
	descriptorEditor: vscode.TextEditor;
	inputEditor: vscode.TextEditor;
	outputEditor: vscode.TextEditor;
	descriptorFilePath: string;
	inputFilePath: string;
	rdfInputFilePath: string; 
	outputFilePath: string;
	additionalInputFilePaths: string[]; 
	templateIRIsChecked: boolean;
	minimalModeChecked: boolean;
	errorFilePath: string; 
}
```

### 2. Tree Data Provider Pattern
**Purpose**: Provides hierarchical data structure for VS Code's Tree View API.

 `vscode.TreeDataProvider` inteface implementation, class that manages conversion items and their display in the sidebar.
**Responsibilities**:
- Load existing conversions from workspace
- Provide tree structure for VS Code
- Handle refresh and update operations
- Manage conversion item lifecycle

### 3. Command-Driven Architecture
All user interactions are handled through VS Code commands.

### 4. File-Based Configuration
**Purpose**: Conversions are persisted as JSON files in a `.vscode/csvw-conversions/` directory.

**Structure**:
```
csvw-rdf-conversions/
└── YourConversionName/
    ├── descriptor.jsonld    # CSVW metadata descriptor
    ├── inputs/
    │   ├── csvInput.csv     # Primary CSV data
    │   ├── rdfInput.ttl     # RDF input for reverse conversion
    │   └── [additional].csv # Additional CSV files
    └── outputs/
        ├── output.ttl       # Generated RDF output
        ├── error.txt        # Error details (if any)
        ├── csv1.csv         # Possibly multiple csv outputs
        └── csv2.csv
```

## Core Components

### 1. Extension Entry Point (`index.ts`)
Handles command registration with VS Code. It sets up tree view provider.
It sets up file listeners. Manages VSCode Extension context. 

### 2. Tree Data Provider (`tree-data-provider.ts`)

Manages the hierarchical display of conversion items in VS Code's sidebar. 

![Sidebar](http://url/to/img.png)

### 3. Command System (`commands/`)

Implements individual user actions as discrete units.
Commands can be invoked from multiple UI elements.
Each command handles one specific action.
Commands are pure functions with clear inputs/outputs.
Centralized error handling and user feedback.
Every command file contains single command and it's helper functions.

### 4. Conversion Logic (`conversion-logic.ts`)
Interfaces with the core conversion library and manages the conversion process.

**Key Functions**:
- `performRdfToCsvwConversion()`: Executes RDF to CSVW conversion
- `performCsvwToRdfConversion()`: Executes CSVW to RDF conversion
- `validateCsvwData()`: Validates CSVW against W3C specification


### Available Commands

| Command ID | Purpose | Trigger |
|------------|---------|---------|
| `addNewConversion` | Create new conversion configuration | Button |
| `convertCsvwToRdf` | Execute CSVW → RDF conversion | Tree item context, Button |
| `convertRdfToCsvw` | Execute RDF → CSVW conversion | Tree item context, Button |
| `validateSpecific` | Validate CSVW metadata | Tree item context |
| `deleteConversion` | Remove conversion configuration | Tree item context |
| `openConversionFields` | Open related files in editor | Tree item click |
| `closeConversionFields` | Close related files in editor | Tree item click |
| `convertCurrentWindow` | Creates new conversion with currently active file | Editor title bar |
| `toggle-minimal-mode` | Sets option minimal mode on/off | Tree item click  |
| `toggle-template-iris` | Sets option template iris on/off | Tree item click  |
| `add-red-underlines` | Adds validation errors animation | Command pallet |
| `clear-red-underlines` | Removes validation errors animation | Command pallet |

## Behaviour of non-trivial commands and listeners

### Save listener
This listener triggers on saving any conversion files (descriptor, inputs).
When triggered for descriptor, it creates imput .csv input files named after descriptor's table.url property.
It deletes other csv input files. If it is triggered for inputs, then it performs the conversion in the direction based on the input file saved(if user saves rdf input it converts it to the csvw). It also updates the conversion input paths if needed.

### ConvertCurrentWindow
This command is triggered by either opening .csv/rdf file and clicking on top right gear button or from tree view button(it takes the currently focused window as the input file). This creates new conversion into the tree view and copies the input file as its input. It also tries to find the descriptor by the CSVW standard for csv inputs.

### ValidateSpecific
Uses validateCsvwFromDescriptor function from core library. This function returns list of errors found in descriptor validation. These errors and then shown in the descriptor window, with their messages. The animation itself is done in add/clear-red-underlines commands, which is called from  validate-specific.

### Open/Close conversion fields

These two commands manage what windows are opened or closed. For each conversion they open/close the descriptor, all inputs and outputs windows(also the error). The windows are shown in a following manner: The editor is split into three columns. First one holds the descriptor window. Second one holds the inputs windows and the third one is for the outputs and errors. Due to the nature of vscode extensions the windows themselfs can be moved, closed or invalidated by the user. These two commands handle these problems.

### Extension activation

The extension activates when:
- VS Code starts (if previously active)
- User executes a command
- Workspace contains CSVW/rdf files

## Modules Documentation

*[HTML documentation](https://s0ft1.github.io/CSVW-RDF-convertor/)*


### Development Tools

- **VS Code Extension Host**: For testing extension behavior
- **TypeScript Compiler**: For type checking and transpilation
- **ESLint**: For code quality and consistency
- **VS Code Test Explorer**: For running and debugging tests
---

This documentation provides a comprehensive guide to understanding and extending the CSVW-RDF Convertor VS Code extension. For specific implementation details, refer to the source code and the API documentation linked above.
