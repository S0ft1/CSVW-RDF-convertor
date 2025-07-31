FROM node:lts-alpine
WORKDIR /csvw-rdf-convertor
RUN --mount=type=bind,source=../../package.json,target=package.json \
    --mount=type=bind,source=../../package-lock.json,target=package-lock.json \
    --mount=type=bind,source=../../packages/core/package.json,target=packages/core/package.json \
    --mount=type=bind,source=package.json,target=packages/cli/package.json \
    npm ci --no-audit
COPY .. .
RUN npx nx build cli
ENTRYPOINT ["node", "packages/cli/dist/index.js"]