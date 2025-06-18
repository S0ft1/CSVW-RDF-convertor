import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import Multipart, { MultipartFile } from '@fastify/multipart';
import * as path from 'node:path';
import os from 'node:os';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

/* eslint-disable-next-line */
export interface AppOptions {}

async function onFile(part: MultipartFile) {
  part.filename = `${randomUUID()}-${part.filename}`;
  await pipeline(
    part.file,
    createWriteStream(path.join(os.tmpdir(), part.filename))
  );
  (part as any).value = part; // this will be attached to the body
}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  console.log(
    'Loading plugins from:',
    path.join(import.meta.dirname, 'plugins')
  );
  fastify.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'plugins'),
    options: { ...opts },
  });

  fastify.register(Multipart, { attachFieldsToBody: 'keyValues', onFile });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'routes'),
    options: { ...opts },
  });
}
