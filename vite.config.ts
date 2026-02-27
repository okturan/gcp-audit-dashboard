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
        // List all authenticated gcloud accounts
        server.middlewares.use('/api/gcloud-accounts', async (_req, res) => {
          try {
            const { stdout } = await execAsync(
              "gcloud auth list --format='json(account,status)'"
            )
            const accounts = JSON.parse(stdout) as { account: string; status: string }[]
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ accounts: accounts.map(a => ({ email: a.account, active: a.status === 'ACTIVE' })) }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(err) }))
          }
        })

        // Get token — optionally for a specific account via ?account=email
        server.middlewares.use('/api/gcloud-token', async (req, res) => {
          try {
            const url = new URL(req.url ?? '/', 'http://localhost')
            const account = url.searchParams.get('account')
            const accountFlag = account ? ` --account=${account}` : ''
            const [{ stdout: token }, { stdout: email }] = await Promise.all([
              execAsync(`gcloud auth print-access-token${accountFlag}`),
              account
                ? Promise.resolve({ stdout: account })
                : execAsync('gcloud config get-value account'),
            ])
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ token: token.trim(), email: typeof email === 'string' ? email.trim() : email }))
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
