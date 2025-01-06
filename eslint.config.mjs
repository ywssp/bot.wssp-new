'use strict';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: [
      '**/out',
      '**/lint-staged.config.js',
      './node_modules/**/*',
      './out/**/*'
    ]
  },
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript'
    )
  ),
  {
    plugins: {
      '@typescript-eslint': fixupPluginRules(typescriptEslint),
      prettier: fixupPluginRules(prettier)
    },

    languageOptions: {
      globals: {
        ...globals.node
      },

      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'commonjs',

      parserOptions: {
        project: './tsconfig.json'
      }
    },

    rules: {
      'prettier/prettier': 'error',
      'consistent-return': 'error',
      curly: ['error', 'all'],
      'default-case': 'error',
      'default-case-last': 'error',
      eqeqeq: 'error',
      'guard-for-in': 'error',
      'handle-callback-err': 'off',

      'max-nested-callbacks': [
        'error',
        {
          max: 4
        }
      ],

      'max-statements-per-line': [
        'error',
        {
          max: 2
        }
      ],

      'no-console': 'error',
      'no-else-return': 'error',
      'no-empty-function': 'error',
      'no-eq-null': 'error',
      'no-inline-comments': 'error',
      'no-lonely-if': 'error',
      'no-nested-ternary': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-restricted-properties': 'error',
      'no-return-await': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-shadow': 'off',

      '@typescript-eslint/no-shadow': [
        'error',
        {
          allow: ['err', 'resolve', 'reject']
        }
      ],

      'no-trailing-spaces': ['error'],
      'no-unneeded-ternary': 'error',
      'no-unreachable-loop': 'error',
      'no-use-before-define': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-regex-literals': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'require-await': 'error',
      'spaced-comment': 'error',
      strict: 'error',
      yoda: 'error',
      'eslint-plugin-import/no-named-as-default-member': 'off'
    }
  }
];
