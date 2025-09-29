# @csvw-rdf-convertor/core

The core library for bidirectional conversion between CSV-W (CSV on the Web) and RDF formats, with full W3C CSVW specification support and validation capabilities.

## Features

- 🔄 **Bidirectional conversion** between CSVW and RDF formats
- 📊 **Multiple RDF serializations** (Turtle, N-Triples, N-Quads, TriG, JSON-LD and RDF/XML)
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
  resolveJsonldFn: yourJsonLdLoaderFunction,
};

// create a RDF.js Stream of quads
const rdfStream = csvwDescriptorToRdf(descriptor, options);
```

### RDF to CSVW Conversion

```typescript
import {
  rdfToCsvw,
  parseRdf,
  rdfToTableSchema,
} from '@csvw-rdf-convertor/core';

// Parse RDF data
const getRdfStream = () => parseRdf('https://example.org/data.ttl');
// In order to support the browser environment, the library can by default
// only fetch from URLs. To load local files, you can use a custom resolveStreamFn option.
// parseRdf('https://example.org/data.ttl', { resolveStreamFn: customResolveStreamFn });

// In the first pass, we infer the schema:
const schema = await rdfToTableSchema(await getRdfStream());

// Then, we convert the RDF data in the second pass:
const csvwStream = rdfToCsvw(await getRdfStream(), { descriptor: schema });

// Process the CSVW output
for await (const { descriptor, table, row } of csvwStream) {
  console.log({ descriptor, table, row });
}
```

### CSVW Validation

```typescript
import {
  validateCsvwFromDescriptor,
  Csvw2RdfOptions,
} from '@csvw-rdf-convertor/core';

const descriptor = '{"@context": "http://www.w3.org/ns/csvw", ...}';
const options: Csvw2RdfOptions = { baseIri: 'http://example.org/' };

// Validate and collect issues
for await (const issue of validateCsvwFromDescriptor(descriptor, options)) {
  console.log(`${issue.type}: ${issue.message}`);
  if (issue.location) {
    console.log(`  at ${issue.location.row}:${issue.location.column}`);
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

| Format    | MIME Type               | Extension    | Streaming |
| --------- | ----------------------- | ------------ | --------- |
| Turtle    | `text/turtle`           | `.ttl`       | ✅        |
| N-Triples | `application/n-triples` | `.nt`        | ✅        |
| N-Quads   | `application/n-quads`   | `.nq`        | ✅        |
| TriG      | `application/trig`      | `.trig`      | ✅        |
| JSON-LD   | `application/ld+json`   | `.jsonld`    | ✅        |
| RDF/XML   | `application/rdf+xml`   | `rdf`, `xml` | ✅        |

## Performance Considerations

- **Streaming**: Use streaming APIs for large datasets to minimize memory usage
- **Window Size**: Adjust `windowSize` for RDF to CSVW conversion based on available memory
- **Minimal Mode**: Use `minimal: true` for faster conversion when metadata richness isn't required

## TypeScript Support

The library is written in TypeScript and provides comprehensive type definitions:

## Documentation

Developer documentation available here: [Dev doc](https://github.com/S0ft1/CSVW-RDF-convertor/edit/main/packages/core/devDoc.md)
Full API documentation is available online: https://s0ft1.github.io/CSVW-RDF-convertor/
