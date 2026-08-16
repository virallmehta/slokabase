// vitest.config.ts
import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // e2e/*.spec.ts are Playwright specs (see playwright.config.ts), not
    // vitest tests — without this, vitest's default include glob picks
    // them up too and fails on Playwright's async test() API.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
