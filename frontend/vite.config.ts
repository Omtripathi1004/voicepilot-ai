import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (typeof process !== 'undefined' && process.cwd) ? process.cwd() : '.')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify('1.0.0'),
    },
  }
})

