/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { edition, singleFile } from './scripts/vite-plugins.ts'
import { isBrandedEdition } from './src/services/edition.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run build:single` puts the whole game in one HTML file. It is always the
  // brand-free edition: the brand photos are separate files it cannot carry.
  const single = mode === 'single'
  const branded = !single && isBrandedEdition(loadEnv(mode, process.cwd(), 'VITE_').VITE_BRAND_ASSETS)

  return {
    plugins: [react(), edition(branded), ...(single ? [singleFile()] : [])],
    define: {
      // Replaced by a literal, so the other edition's code and text drop out of the bundle.
      __BRANDED__: JSON.stringify(branded),
    },
    // Relative URLs: the same build runs at a site root, under a sub-path (GitHub Pages) and inside the Android app.
    base: './',
    server: {
      // `npm run dev -- --host` exposes the dev server to phones on the same network.
      port: 5173,
    },
    optimizeDeps: {
      // Pre-bundle the lazily imported engines so the first game start never triggers a reload.
      include: ['phaser', 'firebase/app', 'firebase/auth', 'firebase/database'],
    },
    build: single
      ? {
          target: 'es2022',
          outDir: 'dist-single',
          copyPublicDir: false,
          // Fonts and pictures become data: URLs, scripts and styles are inlined (scripts/vite-plugins.ts).
          assetsInlineLimit: () => true,
          cssCodeSplit: false,
          modulePreload: false,
          chunkSizeWarningLimit: 4000,
          rolldownOptions: { output: { codeSplitting: false } },
        }
      : {
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
  }
})
