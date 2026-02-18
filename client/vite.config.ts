import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 12096,
    proxy: {
      '/api': {
        target: 'http://localhost:19096',
        changeOrigin: true,
      },
    },
  },
})
