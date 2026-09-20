import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const jevProxy = {
  '/jev-api': {
    target: 'https://api.typesafe.ai',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/jev-api/, ''),
  },
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    open: true,
    proxy: jevProxy,
  },
  preview: {
    proxy: jevProxy,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
})