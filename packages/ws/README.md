# @csvw-rdf-convertor/ws

A web service for RDF - CSVW conversion.

## API

The OpenAPI description file is available at <openapi.yaml>.

## How to run

First, build the webservice.

`npx nx build ws`

Then, either run the webservice locally:

`node packages/ws/dist/main.js`

Or build and run a Docker image.

`npx nx docker-build ws`

`docker run -p 3000:3000 -t csvw-rdf-convertor-ws`
