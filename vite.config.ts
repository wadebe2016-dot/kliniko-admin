import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En developpement, les appels /api sont transmis a l API sur l EC2.
// En production, nginx sert le frontend et route /api vers l API locale.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://35.180.88.49',
        changeOrigin: true,
      },
    },
  },
})
