import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envFront = loadEnv(mode, process.cwd(), '')
  const envRoot = loadEnv(mode, repoRoot, '')
  const base = envFront.VITE_APP_BASE || envRoot.VITE_APP_BASE || '/'
  const apiPort = envFront.AGRIVISION_PORT || envRoot.AGRIVISION_PORT || '8000'
  const apiOrigin =
    envFront.VITE_DEV_API_ORIGIN ||
    envRoot.VITE_DEV_API_ORIGIN ||
    `http://127.0.0.1:${apiPort}`

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
          // Some setups drop custom headers; re-attach Authorization for Clerk JWT to the API.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const a = req.headers.authorization
              if (a) proxyReq.setHeader('Authorization', a)
            })
          },
        },
        '/static': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
