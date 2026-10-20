// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['jest.setup.js', '__tests__/**'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'web-build/**',
      'coverage/**',
      'android/**',
      'ios/**',
    ],
  },
  prettierConfig,
]);
