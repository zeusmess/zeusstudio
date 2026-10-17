/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev -- --host` exposes the dev server to phones on the same network.
    port: 5173,
  },
  build: {
    target: 'es2022',
    // Phaser (~1.2 MB minified) is lazy-loaded into its own chunk when gameplay starts.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    globals: true,
    restoreMocks: true,
  },
})
