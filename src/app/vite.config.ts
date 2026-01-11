import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  
  return {
    plugins: [
      react(),
      nodePolyfills({
        // Whether to polyfill `node:` protocol imports.
        protocolImports: true,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Base path must match what the server expects
    base: '/',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    optimizeDeps: {
      include: ['gcode-toolpath', 'colornames'],
    },
    build: {
      // Output to where the Express server expects to find the app
      outDir: isProd ? '../../dist/axiocnc/app' : '../../output/axiocnc/app',
      emptyOutDir: true,
      // Generate source maps for debugging
      sourcemap: !isProd,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  }
})

