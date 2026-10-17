import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: '#0e0f12' } },
    apple: { ...preset.apple, resizeOptions: { background: '#0e0f12' } },
  },
  images: ['public/logo.svg'],
})
