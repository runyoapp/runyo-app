import { defineConfig } from 'vitest/config'

// Vitest config for pure TS/service tests.
// React Native component tests (with React Native Testing Library) will be
// added in a later phase via a separate config block / project.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.expo/**'],
  },
})
