import { search, input, confirm } from '@inquirer/prompts';
import fuzzysort from 'fuzzysort';
import chalk from 'chalk';

export async function getPathOverrides(descriptor: object) {
  let overrides: Record<string, string> = {};
  const urls = Array.from(allUrls(descriptor)).map((url) =>
    fuzzysort.prepare(url)
  );
  console.log('Would you like to override any paths? (Empty to skip)');

  while (true) {
    const path = await search<string>({
      message: 'Path to override (can use minimatch syntax):',
      source: (term) => findTerm(term ?? '', urls),
    });
    if (path) {
      const override = await input({
        message: 'Override this with:',
        required: true,
        validate: (value) => URL.canParse(value) || 'Must be a valid URL',
      });
      overrides[path] = override;
    } else {
      if (Object.keys(overrides).length > 0) {
        printOverrides(overrides);
        if (
          !(await confirm({
            message: 'Are these overrides correct?',
          }))
        ) {
          overrides = {};
          continue;
        }
      }
      break;
    }
  }
  return overrides;
}

function printOverrides(overrides: Record<string, string>) {
  console.log('\nOverrides:');
  for (const [path, override] of Object.entries(overrides)) {
    console.log(chalk.red(path), '->', chalk.green(override));
  }
}

function findTerm(term: string, urls: Fuzzysort.Prepared[]) {
  if (!term) return [''];
  const results = fuzzysort.go(term, urls, { limit: 7, all: false });
  return results.map((result) => result.target);
}

function allUrls(descriptor: unknown, bag = new Set<string>()) {
  if (typeof descriptor === 'string') {
    if (URL.canParse(descriptor)) {
      bag.add(descriptor);
    }
  } else if (Array.isArray(descriptor)) {
    for (const item of descriptor) {
      allUrls(item, bag);
    }
  } else if (typeof descriptor === 'object' && descriptor !== null) {
    for (const value of Object.values(descriptor)) {
      allUrls(value, bag);
    }
  }
  return bag;
}
