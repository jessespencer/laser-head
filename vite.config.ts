import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Two pages, one build: the full-screen game at /, and the slim mini game at
// /slim.html. They share nothing but the origin — src/slim/ imports nothing
// from src/, and src/ imports nothing from src/slim/.
export default defineConfig({
  base: '/laser-head/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        slim: fileURLToPath(new URL('./slim.html', import.meta.url)),
      },
    },
  },
})
