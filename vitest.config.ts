import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        // Slot times are club-local; pin the viewer's zone so timezone hints are deterministic.
        env: { TZ: 'America/Sao_Paulo' },
        // Interaction-heavy page tests can be slow when the whole suite runs in parallel.
        testTimeout: 20_000,
        restoreMocks: true,
        unstubGlobals: true,
      },
    }),
  ),
)
