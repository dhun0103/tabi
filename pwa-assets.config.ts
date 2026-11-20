import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// `npm run icons` 로 public/logo.svg 에서 PWA 아이콘(PNG)들을 만든다
export default defineConfig({
  preset,
  images: ['public/logo.svg'],
})
