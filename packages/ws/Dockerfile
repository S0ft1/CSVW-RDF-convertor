# This file is generated by Nx.
#
# Build the docker image with `npx nx docker-build @csvw-rdf-convertor/ws`.
# Tip: Modify "docker-build" options in project.json to change docker build args.
#
# Run the container with `docker run -p 3000:3000 -t @csvw-rdf-convertor/ws`.
FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN addgroup --system @csvw-rdf-convertor/ws && \
          adduser --system -G @csvw-rdf-convertor/ws @csvw-rdf-convertor/ws

COPY packages/ws/dist @csvw-rdf-convertor/ws/
RUN chown -R @csvw-rdf-convertor/ws:@csvw-rdf-convertor/ws .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN npm --prefix @csvw-rdf-convertor/ws --omit=dev -f install

CMD [ "node", "@csvw-rdf-convertor/ws" ]
