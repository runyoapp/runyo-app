import { defineConfig } from 'vitest/config'
import path from 'path'

// Vitest config for pure TS/service tests.
// React Native component tests (with React Native Testing Library) will be
// added in a later phase via a separate config block / project.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.expo/**'],
  },
})
