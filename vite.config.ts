import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Firebase(실시간·오프라인) + 지도 라이브러리로 번들이 1MB 정도 됨. 첫 로드 후엔 폰에 캐시됨
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 새 버전을 배포하면 다음 실행 때 자동으로 교체
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'tabi — 여행 일정·지도·가계부',
        short_name: 'tabi',
        description: '일정, 지도, 가계부를 한 곳에서',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 화면(HTML/JS/CSS)을 캐시해서 오프라인에서도 열리게 함
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
        // 한 번 본 지도 조각은 폰에 남겨서 오프라인에서도 보이게
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cyberjapandata\.gsi\.go\.jp\/xyz\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
