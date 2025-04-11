# CSVW-RDF-Convertor

NPRG069 Software Project: Practical teamwork on a larger software project, implemented as a school work. 

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
npm install
npx nx build cli
node packages/cli/dist/index.js
# example: convert local csvw to rdf
node packages/cli/dist/index.js c2r -i local-descriptor.json -o output.ttl
```
