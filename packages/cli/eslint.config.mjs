import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      // SKIP: the inquirer-action-select package does not correctly declare its dependencies,
      // so we need to include them in our own package.json
      // until that is fixed, we will disable this rule here.
      // '@nx/dependency-checks': [
      //   'error',
      //   {
      //     ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
      //   },
      // ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
