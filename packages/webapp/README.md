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

## Docker

The following commands should be run in the monorepo root directory.

```bash
docker build -t csvw-rdf-convertor-webapp --target webapp .
docker run -p 3000:3000 -t csvw-rdf-convertor-webapp
```

## Limitations

Because the conversion happens in the browser, all loaded resources must be exposed with CORS headers. If not, the browser will block the application from fetching the data. This is unfortunately often the case with RDF vocabularies, which could otherwise enrich the RDF → CSVW conversion. Also, some users may experience difficulties with accessing insecure (http:// instead of https://) resources due to their browser settings.
