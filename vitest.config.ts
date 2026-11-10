import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
    css: true,
    server: {
      // The shared UI package ships CSS modules its consumers' tests must load.
      deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] },
    },
  },
})
