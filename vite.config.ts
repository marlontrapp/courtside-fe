import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    server: {
      port: 5173,
      // Avoid EMFILE when the machine’s inotify/fd budget is already exhausted
      // (common with Cursor + multiple watchers). Polling is fine for this app size.
      watch: {
        usePolling: true,
        interval: 300,
      },
      proxy: {
        // Session + CSRF cookies stay same-origin in the browser.
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/api-auth': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
