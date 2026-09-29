import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Dopekit Staff',
        short_name: 'Dopekit',
        description: 'Worker schedule and bookings for Dopekit salon',
        theme_color: '#6d3557',
        background_color: '#141014',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/worker',
        scope: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        globIgnores: ['**/assets/dope*.*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
