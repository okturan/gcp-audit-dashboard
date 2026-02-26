import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'gcloud-token-server',
      configureServer(server) {
        server.middlewares.use('/api/gcloud-token', async (_req, res) => {
          try {
            const [{ stdout: token }, { stdout: email }] = await Promise.all([
              execAsync('gcloud auth print-access-token'),
              execAsync('gcloud config get-value account'),
            ])
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ token: token.trim(), email: email.trim() }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      },
    },
  ],
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'flow-vendor': ['@xyflow/react', '@xyflow/system'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
})
