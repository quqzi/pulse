import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { '@typescript-eslint': ts },
    languageOptions: { parser: tsParser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      'no-undef': 'off',
    },
  },
  {
    files: ['src/**/*.svelte'],
    plugins: { '@typescript-eslint': ts, svelte },
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tsParser },
    },
    rules: {
      ...svelte.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'error',
      'no-undef': 'off',
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/**', '.svelte-kit/**', 'build/**'],
  },
];
