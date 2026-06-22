import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['tests/unit/app.test.js'],
    server: {
      deps: {
        optimizer: {
          web: {
            enabled: false
          }
        }
      }
    }
  },
})
