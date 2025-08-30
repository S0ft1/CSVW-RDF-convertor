# CSVW-RDF-Convertor

A comprehensive toolkit for bidirectional conversion, validation, and integration of CSV on the Web (CSVW) and RDF data. This monorepo provides robust solutions for command-line, web, VS Code, and programmatic environments, all built on a shared, standards-compliant core.

## 🚀 Features

- 🔄 **Bidirectional conversion** between CSVW and RDF (Turtle, N-Triples, N-Quads, TriG, JSON-LD)
- ✅ **CSVW validation** against the W3C specification
- 📊 **Schema inference** and metadata generation
- 🧩 **Modular architecture**: CLI, Web App, VS Code Extension, Web Service, and Core Library
- 📝 **Streaming support** for large datasets
- 🛠️ **Customizable** with advanced options
- 🌍 **Open source** and fully documented

## 📦 Packages & Environments

### 1. [@csvw-rdf-convertor/core](./packages/core/README.md)
The TypeScript library for programmatic conversion and validation. Use it in Node.js, browser, or as a dependency in your own tools.

- Bidirectional conversion API
- Streaming and async support
- Full TypeScript types
- [Read the Core README](./packages/core/README.md)

### 2. [@csvw-rdf-convertor/cli](./packages/cli/README.md)
A command-line interface for conversion, validation, and automation.

- npx and Docker usage
- All conversion and validation features
- Scripting and pipeline friendly
- Interactive mode
- [Read the CLI README](./packages/cli/README.md)

### 3. [@csvw-rdf-convertor/webapp](./packages/webapp/README.md)
A modern web application for interactive conversion and validation.

- Drag-and-drop interface
- Export and import support
- [Read the Webapp README](./packages/webapp/README.md)

### 4. [@csvw-rdf-convertor/vscode](./packages/vscode/README.md)
A Visual Studio Code extension for seamless CSVW/RDF workflows inside your editor.

- Real-time feedback and visualization
- One-click conversion and validation
- Tree view for managing conversions
- Integrated with VS Code commands and UI
- [Read the VS Code README](./packages/vscode/README.md)

### 5. [@csvw-rdf-convertor/ws](./packages/ws/README.md)
A web service (API server) for remote and automated conversion.

- RESTful endpoints for conversion and validation
- [Read the WS README](./packages/ws/README.md)

## 📚 Documentation

- [Core API Docs](https://s0ft1.github.io/CSVW-RDF-convertor/)
- [CSVW W3C Specification](https://www.w3.org/TR/tabular-data-primer/)
- [Issues & Discussions](https://github.com/S0ft1/CSVW-RDF-convertor/issues)



---

> **Explore each environment for detailed usage, examples, and advanced options. Start with the [Core README](./packages/core/README.md) or jump to your preferred interface!**
