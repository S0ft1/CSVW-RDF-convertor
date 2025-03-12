# CSSWRDFConvertor

Software team project.

## Run CLI using docker

```bash
docker build -t csvw_cli .
docker run -it --rm csvw_cli
# example: convert local csvw to rdf
docker run -it --rm -v $PWD:/app csvw_cli c2r -i /app/local-descriptor.json -o /app/output.ttl
```

## Build and run yourself

Requires Node.js 22

```bash
npm i
npx nx build cli
node packages/cli/dist/index.js
# example: convert local csvw to rdf
node packages/cli/dist/index.js -i local-descriptor.json -o output.ttl
```
