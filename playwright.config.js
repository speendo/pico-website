import { defineConfig } from '@playwright/test'

const libPath = '/tmp/glib-noble/usr/lib/x86_64-linux-gnu:/tmp/playwright-libs/usr/lib/x86_64-linux-gnu'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8765',
    launchOptions: {
      env: {
        ...process.env,
        LD_LIBRARY_PATH: libPath,
      },
    },
  },
  webServer: {
    command: 'uvicorn test_server.main:app --host 127.0.0.1 --port 8765',
    port: 8765,
    reuseExistingServer: !process.env.CI,
  },
})
