import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: { assetsInlineLimit: 0 },
  server: {
    host: '127.0.0.1',
    proxy: { '/api': process.env.SUPPORTHUB_API_ORIGIN ?? 'http://127.0.0.1:8080' },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/shared/test-setup.ts'],
  },
})
