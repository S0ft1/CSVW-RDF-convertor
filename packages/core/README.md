# @csvw-rdf-convertor/core

The core library for bidirectional conversion between CSV-W (CSV on the Web) and RDF formats, with full W3C CSVW specification support and validation capabilities.

## Features

- 🔄 **Bidirectional conversion** between CSVW and RDF formats
- 📊 **Multiple RDF serializations** (Turtle, N-Triples, N-Quads, TriG, JSON-LD)
- ✅ **CSVW validation** against W3C specification
- 🚀 **Streaming support** for large datasets
- 🎯 **Schema inference** from RDF data
- 📝 **Template IRIs** and custom prefix support
- 🔧 **Configurable options** for fine-tuned conversion
- 📋 **Issue tracking** with detailed error reporting

## Installation

```bash
npm install @csvw-rdf-convertor/core
```

## Quick Start

### CSVW to RDF Conversion

```typescript
import { csvwDescriptorToRdf, Csvw2RdfOptions } from '@csvw-rdf-convertor/core';
import fs from 'node:fs';

const descriptor = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
const options: Csvw2RdfOptions = {
    templateIris: true,
    minimal: false,
    resolveJsonldFn: yourJsonLdLoaderFunction
};
const rdfStream = csvwDescriptorToRdf(descriptor, options);

// Process the RDF quads
for await (const quad of rdfStream) {
    console.log(quad.subject.value, quad.predicate.value, quad.object.value);
}


```

### RDF to CSVW Conversion

```typescript
import { rdfToCsvw, parseRdf, Rdf2CsvOptions } from '@csvw-rdf-convertor/core';
import fs from 'node:fs';

// Parse RDF data
const rdfData = fs.readFileSync('data.ttl', 'utf8');
const rdfStream = parseRdf(rdfData, 'text/turtle');
const descriptorText = fs.readFileSync('descriptor.jsonld', 'utf8')
// Convert to CSVW
const options: Rdf2CsvOptions = {
    descriptor: descriptorText
};

const csvwStream = await rdfToCsvw(rdfStream, options);

// Process the CSVW output
csvwStream.pipe(process.stdout);
```

### CSVW Validation

```typescript
import { validateCsvwFromDescriptor, Csvw2RdfOptions } from '@csvw-rdf-convertor/core';

const descriptor = '{"@context": "http://www.w3.org/ns/csvw", ...}';
const options: Csvw2RdfOptions = { baseIri: 'http://example.org/' };

// Validate and collect issues
for await (const issue of validateCsvwFromDescriptor(descriptor, options)) {
  console.log(`${issue.type}: ${issue.message}`);
  if (issue.location) {
    console.log(`  at ${issue.location.line}:${issue.location.column}`);
  }
}
```

## Configuration Options

### Csvw2RdfOptions

Options for CSVW to RDF conversion:

```typescript
interface Csvw2RdfOptions extends ConversionOptions {
  /** Use template IRIs instead of full URIs (default: false) */
  templateIris?: boolean;
  
  /** Generate minimal RDF output, omitting optional metadata (default: false) */
  minimal?: boolean;
  
  /** Function for loading CSV files */
  resolveCsvStreamFn?: ResolveCsvStreamFn;
  
  /** Function for loading .well-known/csvm files */
  resolveWkfFn?: ResolveWkfFn;
}
```

### Rdf2CsvOptions

Options for RDF to CSVW conversion:

```typescript
interface Rdf2CsvOptions extends ConversionOptions {
  /** CSVW descriptor template for conversion */
  descriptor?: string | AnyCsvwDescriptor | TableGroupSchema;
  
  /** Use vocabulary metadata to enrich conversion (default: false) */
  useVocabMetadata?: boolean;
  
  /** Number of quads to process at once (default: auto) */
  windowSize?: number;
  
  /** Function for loading remote RDF data */
  resolveRdfFn?: ResolveRdfFn;
}
```

### ConversionOptions

Base options for all conversions:

```typescript
interface ConversionOptions {
  /** Path replacement patterns [pattern, replacement] */
  pathOverrides?: [string | RegExp, string][];
  
  /** Base IRI for resolving relative references */
  baseIri?: string;
  
  /** Function for loading JSON-LD resources */
  resolveJsonldFn?: ResolveJsonldFn;
  
  /** Logging level (Error=0, Warn=1, Debug=2) */
  logLevel?: LogLevel;
  
  /** Caching interface for remote resources */
  cache?: FetchCacheInterface;
}
```

## Supported RDF Formats

| Format | MIME Type | Extension | Streaming |
|--------|-----------|-----------|-----------|
| Turtle | `text/turtle` | `.ttl` | ✅ |
| N-Triples | `application/n-triples` | `.nt` | ✅ |
| N-Quads | `application/n-quads` | `.nq` | ✅ |
| TriG | `application/trig` | `.trig` | ✅ |
| JSON-LD | `application/ld+json` | `.jsonld` | ✅ |


## Performance Considerations

- **Streaming**: Use streaming APIs for large datasets to minimize memory usage
- **Window Size**: Adjust `windowSize` for RDF to CSVW conversion based on available memory
- **Minimal Mode**: Use `minimal: true` for faster conversion when metadata richness isn't required

## TypeScript Support

The library is written in TypeScript and provides comprehensive type definitions:

## Documentation

Full API documentation is available online: https://s0ft1.github.io/CSVW-RDF-convertor/
