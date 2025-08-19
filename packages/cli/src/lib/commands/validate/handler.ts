import { ValidateArgs } from './command.js';
import {
  Csvw2RdfOptions,
  defaultResolveJsonldFn,
  defaultResolveStreamFn,
  defaultResolveTextFn,
  LogLevel,
  Issue,
  validateCsvwFromUrl,
  validateCsvwFromDescriptor,
} from '@csvw-rdf-convertor/core';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { getPathOverrides } from '../interactive/get-path-overrides.js';
import { MMRegExp } from 'minimatch';

export type ArgsWithDefaults = ValidateArgs;

export async function handler(args: ArgsWithDefaults): Promise<void> {
  const options = getOptions(args);
  let stream: AsyncIterable<Issue>;
  if (args.input?.match(/\.csv([?#].*)?$/)) {
    if (!args.pathOverrides?.length && args.interactive) {
      args.pathOverrides = await getPathOverrides(null);
    }
    stream = validateCsvwFromUrl(args.input, options);
  } else {
    const descriptorText = args.input
      ? ((await options.resolveJsonldFn?.(args.input, '')) ?? '')
      : await text(process.stdin);
    const descriptor = JSON.parse(descriptorText);
    if (!args.pathOverrides?.length && args.interactive) {
      args.pathOverrides = await getPathOverrides(descriptor);
    }

    stream = validateCsvwFromDescriptor(descriptor, {
      ...options,
      originalUrl: args.input,
    });
  }

  if (args.interactive) {
    console.log('Final command:');
    console.log(showFullCommand(args));
  }

  let issuesCount = 0;
  for await (const issue of stream) {
    issuesCount++;
    if (issue.type === 'error') {
      console.error(issue);
    } else {
      console.warn(issue);
    }
  }

  if (issuesCount > 0) {
    console.error(`Validation failed with ${issuesCount} issues found.`);
  } else {
    console.log('Validation succeeded with no issues found.');
  }
}

function getOptions(args: ValidateArgs): Csvw2RdfOptions {
  const getUrl = (path: string, base: string) =>
    URL.parse(path, base)?.href ?? URL.parse(path)?.href ?? resolve(base, path);
  return {
    baseIri:
      args.baseIri ??
      (args.input && URL.canParse(args.input)
        ? args.input
        : dirname(resolve(process.cwd(), args.input ?? ''))),
    pathOverrides: args.pathOverrides ?? [],
    logLevel:
      args.logLevel === 'debug'
        ? LogLevel.Debug
        : args.logLevel === 'warn'
          ? LogLevel.Warn
          : LogLevel.Error,
    resolveJsonldFn: async (path, base) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && URL.canParse(url)) {
        if (url.startsWith('file:')) {
          return readFile(fileURLToPath(url), 'utf-8');
        }
        return defaultResolveJsonldFn(url, base);
      }
      return await readFile(url, 'utf-8');
    },
    resolveWkfFn: async (path, base) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && URL.canParse(url)) {
        if (url.startsWith('file:')) {
          return readFile(fileURLToPath(url), 'utf-8');
        }
        return defaultResolveTextFn(url, base);
      }
      return await readFile(url, 'utf-8');
    },
    resolveCsvStreamFn: (path, base) => {
      const url = getUrl(path, base);
      if (!isAbsolute(url) && (URL.canParse(url) || URL.canParse(url, base))) {
        if (url.startsWith('file:')) {
          return Promise.resolve(
            Readable.toWeb(fs.createReadStream(fileURLToPath(url), 'utf-8')),
          );
        }
        return defaultResolveStreamFn(url, base);
      }
      return Promise.resolve(
        Readable.toWeb(fs.createReadStream(resolve(base, url), 'utf-8')),
      );
    },
  };
}

function showFullCommand(args: ArgsWithDefaults): string {
  const command = [
    'csvw2rdf',
    args.input ? `--input ${args.input}` : '',
    args.baseIri && args.baseIri !== args.input
      ? `--baseIri ${args.baseIri}`
      : '',
    args.pathOverrides?.length
      ? `--pathOverrides ${args.pathOverrides
          .flatMap(([o, p]) => [
            o instanceof RegExp ? (o as MMRegExp)._glob : o,
            p,
          ])
          .join(' ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return command;
}
