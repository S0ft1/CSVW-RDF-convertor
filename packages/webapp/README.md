# Webapp

A frontend only application for CSVW - RDF conversion.

## Serve

```bash
npx nx serve webapp
```

## Build

```bash
npx nx build webapp
```

## Limitations

Because the conversion happens in the browser, all loaded resources must be exposed with CORS headers. If not, the browser will block the application from fetching the data. This is unfortunately often the case with RDF vocabularies, which could otherwise enrich the RDF → CSVW conversion. Also, some users may experience difficulties with accessing insecure (http:// instead of https://) resources due to their browser settings.
