import tsParser from '@typescript-eslint/parser'

// Minimal flat config voor ESLint 9.
// Doel in 1.1: parser staat, `npm run lint` werkt met --max-warnings 0.
// Uitgebreidere ruleset (strict TS, React hooks, naming) komt in een latere
// fase wanneer de codebase op één lijn ligt.
export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'assets/**', 'babel.config.js', 'eslint.config.mjs', 'vitest.config.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {},
  },
]
