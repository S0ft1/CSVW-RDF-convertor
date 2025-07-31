# @csvw-rdf-convertor/cli

Convert RDF and CSVW from command line.

## Run using npx (recommended)

```bash
npx @csvw-rdf-convertor/cli@latest --help
# example: convert local csvw to rdf
npx @csvw-rdf-convertor/cli@latest c2r -i local-descriptor.json -o output.ttl
```

## Run CLI using docker

```bash
docker build -t csvw_cli .
docker run -it --rm csvw_cli
# example: convert local csvw to rdf
docker run -it --rm -v $PWD:/app csvw_cli c2r -i /app/local-descriptor.json -o /app/output.ttl
```

## Build and run yourself

Requires Node.js 22. Run these commands in the monorepo root folder.

```bash
npm install
npx nx build cli
node packages/cli/dist/index.js
# example: convert local csvw to rdf
node packages/cli/dist/index.js c2r -i local-descriptor.json -o output.ttl
```
