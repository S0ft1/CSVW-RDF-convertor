# CSVW RDF Converter - VS Code Extension

A VS Code extension for converting between CSV on the Web (CSVW) and RDF formats. This extension provides an intuitive interface for bidirectional conversion between tabular data and RDF, following W3C CSVW specifications.

## 🚀 Features

- **Bidirectional Conversion**: Convert between CSVW and RDF formats seamlessly
- **Visual Tree Interface**: Manage multiple conversions through an organized tree view
- **Auto-conversion**: Automatic conversion on file saves for rapid development
- **CSVW Specification Compliance**: Full support for W3C CSVW metadata specifications
- **Multiple Input Support**: Handle multiple CSV files within a single conversion
- **Template IRI Support**: Toggle template IRI generation for RDF output
- **Minimal Mode**: Streamlined output options for cleaner results
- **Workspace Integration**: Seamless integration with VS Code workspace folders

## 📦 Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "CSVW RDF Converter"
4. Click Install
5. Reload VS Code if prompted

## 🎯 Getting Started

### Opening the Extension

After installation, you'll see a new activity bar icon (📄) on the left side of VS Code. Click it to open the **CSVW RDF Converter** panel.

### Creating Your First Conversion

#### Method 1: From Current File
1. Open a CSV or RDF file in VS Code
2. Click the **Convert Current Window** button in the editor toolbar or on the gear button at the top right
3. Enter a name for your conversion
4. The extension will automatically set up the conversion structure

#### Method 2: Manual Creation
1. Click the **Add Conversion** button (➕) in the extension panel
2. Enter a name for your conversion
3. Default rdf and csv inputs files are created

## 🏗️ Understanding the Conversion Structure

Each conversion creates a folder structure in your workspace:

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
        └── error.txt        # Error details (if any)
```

## 🔄 Conversion Workflows

### CSV to RDF Conversion

1. **Open Conversion Fields**: Click the folder icon next to your conversion
2. **Edit Input Files**: Modify your CSV data and descriptor metadata
3. **Save Files**: The extension automatically converts on saving the input files
4. **View Results**: RDF output appears in the outputs folder

### RDF to CSVW Conversion

1. **Open Conversion Fields**: Access your conversion workspace
2. **Edit RDF Input**: Modify the `rdfInput.ttl` file
3. **Configure Descriptor**: Set up CSVW metadata for desired CSV structure
4. **Save and Convert**: Automatic conversion generates CSV files

### Advanced Features

#### Multiple CSV Files
- Use **Add Another Input** to include multiple CSV files in one conversion
- Each file is processed according to the descriptor configuration

#### Template IRIs
- Toggle **Template IRIs** to control IRI generation patterns
- Useful for creating consistent URI schemes across datasets

#### Minimal Mode
- Enable **Minimal Mode** for cleaner, more compact RDF output
- Reduces verbosity while maintaining semantic accuracy

## 🎛️ Extension Commands

### Tree View Commands

| Command | Icon | Description |
|---------|------|-------------|
| **Add Conversion** | ➕ | Create a new conversion workspace |
| **Open Conversion Fields** | 📁 | Open all files related to a conversion |
| **Close Conversion Fields** | ✖️ | Close all conversion-related tabs |
| **Delete Conversion** | 🗑️ | Permanently remove a conversion and its files |

### Conversion Commands

| Command | Icon | Description |
|---------|------|-------------|
| **Convert CSVW to RDF** | ➡️ | Manual trigger for CSV→RDF conversion |
| **Convert RDF to CSVW** | ⬅️ | Manual trigger for RDF→CSV conversion |
| **Validate Specific** | ✅ | Validate current conversion setup |

### Utility Commands

| Command | Icon | Description |
|---------|------|-------------|
| **Convert Current Window** | ⚙️ | Create conversion from active file |
| **Add Another Input** | ➕ | Add additional CSV input file |
| **Toggle Template IRIs** | 🔗 | Enable/disable template IRI generation |
| **Toggle Minimal Mode** | 🌲 | Enable/disable minimal output mode |
| **Clear Red Underlines** | 🧹 | Clear validation error indicators |

Due to the nature of vscode extensions, sometimes not all windows are closed correctly. 
For example when you rename your csv table in the descriptor, 
new file with this name is created, but sometimes the old one doesn't close.

## 📖 Working with CSVW Descriptors

The `descriptor.jsonld` file is the heart of CSVW conversion. 
Read about it here: https://www.w3.org/ns/csvw

## 🔧 Configuration Options

### Template IRIs
When enabled, generates consistent URI patterns:
```
# Template IRI enabled
<http://example.org/person/1>

# Template IRI disabled  
<http://example.org/person#1>
```

### Minimal Mode
Reduces RDF verbosity by:
- Omitting optional metadata
- Using more compact representations
- Focusing on core data relationships

## 🚨 Error Handling

### Error Display
- Errors appear in `error.txt` files within the outputs folder
- Red underline on the first line indicates validation issues in your files


## 🔄 Auto-conversion Behavior

The extension automatically converts when you save:

| File Type | Triggers | Result |
|-----------|----------|---------|
| **CSV Input** | Save CSV file | CSV → RDF conversion |
| **RDF Input** | Save RDF file | RDF → CSV conversion |
| **Descriptor** | Save descriptor | Input files updated, no conversion |

## 📁 Workspace Integration

### File Organization
- All conversions stored in `csvw-rdf-conversions/` folder
- Each conversion has its own subdirectory
- Files automatically created and managed

### Multi-root Workspaces
- Extension works with the first workspace folder
- Ensure your main project is the first folder in multi-root setups

## 🆘 Support and Resources

### W3C CSVW Specification
- [CSVW Primer](https://www.w3.org/TR/tabular-data-primer/)
- [Metadata Vocabulary](https://www.w3.org/TR/tabular-metadata/)
- [CSV2RDF Mapping](https://www.w3.org/TR/csv2rdf/)

---

## 🏷️ Version Information

**Extension Version**: 1.0.0

---

*Happy converting! 🎉*
