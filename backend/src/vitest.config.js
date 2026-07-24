// vitest.config.js
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false, // Prevents SQLite database lock file errors during multiple tests
  },
  resolve: {
    alias: {
      '#config': fileURLToPath(new URL('./src/config', import.meta.url)),
      '#db': fileURLToPath(new URL('./src/db', import.meta.url)),
      '#middleware': fileURLToPath(new URL('./src/middleware', import.meta.url)),
      '#routes': fileURLToPath(new URL('./src/routes', import.meta.url)),
      '#controllers': fileURLToPath(new URL('./src/controllers', import.meta.url)),
      '#services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '#utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '#validators': fileURLToPath(new URL('./src/validators', import.meta.url)),
    },
  },
});
