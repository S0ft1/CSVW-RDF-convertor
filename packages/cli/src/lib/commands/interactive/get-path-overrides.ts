import { search, input, confirm } from '@inquirer/prompts';
import fuzzysort from 'fuzzysort';
import chalk from 'chalk';
import { makeRe, MMRegExp } from 'minimatch';
import { allUris, getPrefixCandidates } from '@csvw-rdf-convertor/core';
import { Quad } from '@rdfjs/types';

/**
 * Get path overrides from the user.
 * @param descriptor csvw descriptor as JSON object
 */
export async function getPathOverrides(
  descriptor: unknown
): Promise<[string | RegExp, string][]> {
  const overrides = await getOverrides(allUris(descriptor), {
    initial: 'Would you like to override any paths? (Empty to skip)',
    search: 'Path to override (can use minimatch syntax):',
    override: 'Override with:',
    confirm: 'Are these overrides correct?',
    list: 'Current overrides:',
    listLine: (val, override) =>
      chalk.red(val) + ' -> ' + chalk.green(override),
  });
  return overrides.map(([o, p]) => {
    const res = [makeRe(o) || o, p] as [string | RegExp, string];
    if (res[0] instanceof RegExp) {
      (res[0] as MMRegExp)._glob = o;
    }
    return res;
  });
}

/**
 * Get prefixes from the user.
 * @param quads Quads to lookup prefixes for
 */
export async function getPrefixes(
  quads?: Quad[]
): Promise<[string | RegExp, string][]> {
  const iris = quads ? getPrefixCandidates(quads) : [];
  const prefixes = await getOverrides(
    iris,
    {
      initial: 'Would you like to add custom IRI prefixes? (Empty to skip)',
      search: 'IRI to prefix:',
      override: 'Prefix name: (can be empty)',
      confirm: 'Are these prefixes correct?',
      list: 'Current prefixes:',
      listLine: (val, override) => '@prefix ' + override + ': ' + val + ' .',
    },
    true
  );
  return prefixes;
}

/**
 * Get replacements for some of the given values interactively.
 * @param values values to get overrides for
 * @param messages messages to show to the user
 * @param allowEmpty is empty string an acceptable replacement
 * @param validationFn function to validate the input
 */
export async function getOverrides(
  values: Iterable<string>,
  messages: {
    initial: string;
    search: string;
    override: string;
    confirm: string;
    list: string;
    listLine: (value: string, override: string) => string;
  },
  allowEmpty = false,
  validationFn?: (value: string) => boolean | string
): Promise<[string, string][]> {
  let overrides: [string, string][] = [];
  const prepared = Array.from(values).map((url) => fuzzysort.prepare(url));
  console.log(messages.initial);

  while (true) {
    const value = await search<string>({
      message: messages.search,
      source: (term) => findTerm(term ?? '', prepared),
    });
    if (value) {
      const override = await input({
        message: messages.override,
        required: !allowEmpty,
        validate: validationFn,
      });
      overrides.push([override, value]);
    } else {
      if (Object.keys(overrides).length > 0) {
        console.log('\n' + messages.list);
        for (const [override, path] of overrides) {
          console.log(messages.listLine(path, override));
        }
        if (
          !(await confirm({
            message: messages.confirm,
          }))
        ) {
          console.log('Clearing...');
          overrides = [];
          continue;
        }
      }
      break;
    }
  }
  return overrides;
}

function findTerm(term: string, urls: Fuzzysort.Prepared[]) {
  if (!term) return [''];
  const results = fuzzysort
    .go(term, urls, { limit: 7, all: false })
    .map((result) => result.target);
  results.unshift(term);
  return results;
}
