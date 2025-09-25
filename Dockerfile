# build stage
# note: mount bind is used instead of copying
FROM node:lts-alpine AS build
WORKDIR /app
RUN mkdir -p packages/ws
RUN --mount=type=bind,source=package.json,target=package.json \
  --mount=type=bind,source=package-lock.json,target=package-lock.json \
  # add any other packages here if needed
  --mount=type=bind,source=packages/ws/package.json,target=packages/ws/package.json \
  --mount=type=bind,source=packages/cli/package.json,target=packages/cli/package.json \
  --mount=type=bind,source=packages/webapp/package.json,target=packages/webapp/package.json \
  npm ci
COPY . .
# add any other packages here if needed
RUN npx nx run-many --target=build --projects=cli,ws,webapp

# separate lean stages for each package

# ws package
# Run the container with `docker run -p 3000:3000 -t csvw-rdf-convertor-ws`.
# Build with `docker build -t csvw-rdf-convertor-ws --target ws .`
FROM node:lts-alpine AS ws
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN addgroup --system csvw-rdf-convertor && \
  adduser --system -G csvw-rdf-convertor csvw-rdf-convertor && \
  apk add --no-cache git
COPY --from=build /app/packages/ws/dist csvw-rdf-convertor
RUN chown -R csvw-rdf-convertor:csvw-rdf-convertor . && \
  npm --prefix csvw-rdf-convertor --omit=dev -f install

CMD [ "node", "csvw-rdf-convertor" ]

# cli package
# Run the container with `docker run -t csvw-rdf-convertor-cli`.
# Build with `docker build -t csvw-rdf-convertor-cli --target cli .`
FROM node:lts-alpine AS cli
WORKDIR /app
RUN addgroup --system csvw-rdf-convertor && \
  adduser --system -G csvw-rdf-convertor csvw-rdf-convertor && \
  apk add --no-cache git
COPY --from=build /app/packages/cli/dist csvw-rdf-convertor
RUN chown -R csvw-rdf-convertor:csvw-rdf-convertor . && \
  npm --prefix csvw-rdf-convertor --omit=dev -f install

ENTRYPOINT [ "node", "csvw-rdf-convertor" ]

# webapp package
# Run the container with `docker run -p 3000:3000 -t csvw-rdf-convertor-webapp`.
# Build with `docker build -t csvw-rdf-convertor-webapp --target webapp .`
FROM lipanski/docker-static-website:latest AS webapp
COPY --from=build /app/packages/webapp/dist/browser .
