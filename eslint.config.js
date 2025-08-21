
import { readFileSync } from 'fs';
import eslintPluginTs from '@typescript-eslint/eslint-plugin';
import eslintParserTs from '@typescript-eslint/parser';
import angularPlugin from '@angular-eslint/eslint-plugin';
import angularTemplatePlugin from '@angular-eslint/eslint-plugin-template';
import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import angularTemplateParser from '@angular-eslint/template-parser';

export default [
  {
    ignores: ['dist/**/*'],
    files: ['**/*.ts'],
    languageOptions: {
      parser: eslintParserTs,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        sourceType: 'module',
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      }
    },
    plugins: {
      '@typescript-eslint': eslintPluginTs,
      '@angular-eslint': angularPlugin,
      'import': importPlugin,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@angular-eslint/component-class-suffix': ['error', { suffixes: ['Component'] }],
      '@angular-eslint/directive-class-suffix': ['error', { suffixes: ['Directive'] }],
      '@angular-eslint/no-empty-lifecycle-method': 'off',
      '@angular-eslint/use-lifecycle-interface': 'off',
      '@angular-eslint/contextual-decorator': 'error',
      'import/no-unresolved': 'error',
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/*.spec.ts', '**/testing/**'] }],
      'import/no-cycle': ['error', { maxDepth: 1 }],
      'simple-import-sort/imports': ['error', {
        groups: [
          ['^\\u0000', '^@?\\w'],
          ['^@cadai(/.*|$)'],
          ['^@/'],
          ['^\\.'],
          ['^.+\\.(scss|css)$']
        ]
      }],
      'simple-import-sort/exports': 'error',
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              'projects/core/*/*',
              '!projects/core/**/public-api',
              '!@cadai/pxs-ng-core',
              '!@cadai/pxs-ng-core/*'
            ],
            message: 'Import from published entry points only (e.g. @cadai/pxs-ng-core/<entry>).'
          }
        ]
      }]
    }
  },
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin,
    },
    rules: {
    }
  }
];
