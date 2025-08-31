# @csvw-rdf-convertor/cli

A command-line interface for converting between CSVW (CSV on the Web) and RDF formats, with support for the W3C CSVW specification.

## Features

- 🔄 **Bidirectional conversion** between CSVW and RDF formats
- 📊 **Multiple RDF formats** supported (Turtle, N-Triples, N-Quads, TriG, JSON-LD and RDF/XML)
- ✅ **CSVW validation** to ensure specification compliance
- 🎯 **Interactive mode** for guided conversions
- 🚀 **Streaming support** for large datasets
- 🎨 **Template IRIs** and customizable prefixes
- 📝 **Minimal mode** for optimized output
- 🐳 **Docker support** for containerized deployments

## Quick Start

### Using npx (Recommended)

Run the CLI directly without installation:

```bash
# Get help
npx @csvw-rdf-convertor/cli@latest --help

# Convert local CSVW to RDF
npx @csvw-rdf-convertor/cli@latest c2r -i local-descriptor.json -o output.ttl

# Convert RDF to CSVW
npx @csvw-rdf-convertor/cli@latest r2c -i data.ttl -d loacal-descriptor.json --out outDir

# Validate CSVW
npx @csvw-rdf-convertor/cli@latest validate -i metadata.json
```

## Run CLI using docker

```bash
docker build -t csvw_cli .
docker run -it --rm csvw_cli
# example: convert local csvw to rdf
docker run -it --rm -v $PWD:/app csvw_cli c2r -i /app/local-descriptor.json -o /app/output.ttl
```

##Build and run yourself
Requires Node.js 22. Run these commands in the monorepo root folder.

```bash
npm install
npx nx build cli
node packages/cli/dist/index.js
# example: convert local csvw to rdf
node packages/cli/dist/index.js c2r -i local-descriptor.json -o output.ttl
```

## Usage

### Commands Overview

| Command    | Alias | Description                                      |
| ---------- | ----- | ------------------------------------------------ |
| `csvw2rdf` | `c2r` | Convert CSVW metadata and CSV files to RDF       |
| `rdf2csvw` | `r2c` | Convert RDF data to CSVW format                  |
| `validate` | -     | Validate CSVW metadata against W3C specification |

### csvw2rdf Options

- `-i, --input <file>` - Input file or URL
- `-o, --output <directory>` - Output directory
- `--baseIri <IRI>` - Sets base IRI
- `--templateIris <bool>` - Use template IRIs instead of URIs (e.g. https://example.com/{name} could result in https://example.com/Adéla instead of https://example.com/Ad%C3%A9la)
- `--minimal` - Use minimal conversion mode
- `--interactive` - Interactive mode
- `--pathOverrides <path1 value1 path2 value2 ...>` - Overrides paths in a descriptor
- `--turtle.base <IRI>` - Sets turtle base IRI
- `--turtle.prefixLookup ` - Enables prefix lookup by prefix.cc
- `--turtle.streaming <bool>` - Enable streaming mode for large files
- `--turtle.prefix <paths>` - Provides the conversion with prefixes
- `--format <rdf serialization>` - Select rdf serialization from (json,jsonld,nq,nt,xml,rdf,trig,ttl)
- `--help` - Show help information
- `--version` - Show version number

### rdf2csvw Options

- `-i, --input <file>` - Input file or URL
- `-d, --descriptor <file>` - Location of a CSVW descriptor to base the conversion on.
- `-o, --outDir <directory>` - Output directory
- `--baseIri <IRI>` - Sets base IRI
- `--interactive` - Interactive mode
- `--useVocabMetadata` - Use information from referenced vocabularies to enrich the conversion.
- `--windowSize <number> ` - How many triples to keep in memory when processing streaming data.
- `--pathOverrides <path1 value1 path2 value2 ...>` - Overrides paths in a descriptor
- `--help` - Show help information
- `--version` - Show version number

#### Examples

```bash
# Basic conversion
csvw-rdf-convertor c2r -i metadata.json -o output.ttl

# Convert with custom format
csvw-rdf-convertor c2r -i metadata.json -o output.nq --format nquads

# Minimal mode with custom base IRI
csvw-rdf-convertor c2r -i metadata.json -o output.ttl --minimal --turtle.base http://example.org/

# Interactive mode
csvw-rdf-convertor c2r -i metadata.json --interactive

# Custom prefixes
csvw-rdf-convertor c2r -i metadata.json -o output.ttl \
  --turtle.prefix ex: http://example.org/ \
  --turtle.prefix foaf: http://xmlns.com/foaf/0.1/

# Stream from URL to stdout
csvw-rdf-convertor c2r -i https://example.org/metadata.json --format turtle

# Basic RDF to CSVW conversion
csvw-rdf-convertor r2c -i data.ttl -o ./output/

csvw-rdf-convertor validate -i metadata.json

```

## Input Sources

The CLI supports multiple input sources:

- **Local files**: `-i ./path/to/file.json`
- **URLs**: `-i https://example.org/metadata.json`

## Output Options

- **File output**: `-o filename.ttl`
- **Directory output**: For RDF to CSVW conversion, specify output directory

## Supported RDF Formats

| Format    | Extension     | MIME Type               |
| --------- | ------------- | ----------------------- |
| Turtle    | `.ttl`        | `text/turtle`           |
| N-Triples | `.nt`         | `application/n-triples` |
| N-Quads   | `.nq`         | `application/n-quads`   |
| TriG      | `.trig`       | `application/trig`      |
| JSON-LD   | `.jsonld`     | `application/ld+json`   |
| RDF/XML   | `.rdf`, `xml` | `application/rdf+xml`   |

## Logging

Control output verbosity with the `--log-level` option:

- `error` - Only errors
- `warn` - Warnings and errors
- `info` - Informational messages (default)
- `debug` - Detailed debugging information

## Documentation

Full API documentation is available online: https://s0ft1.github.io/CSVW-RDF-convertor/

## Support

- 📖 [W3C CSVW Specification](https://www.w3.org/TR/tabular-data-primer/)
- 🐛 [Report Issues](https://github.com/S0ft1/CSVW-RDF-convertor/issues)
- 💬 [Discussions](https://github.com/S0ft1/CSVW-RDF-convertor/discussions)
