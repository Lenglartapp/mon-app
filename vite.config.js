import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Plugin DEV uniquement : sert les fonctions serverless /api/odoo/* directement dans le
// serveur Vite (npm run dev), en réutilisant les mêmes handlers que sur Vercel.
// En production, ce plugin ne s'applique pas : ce sont les vraies fonctions Vercel qui répondent.
function odooApiDevPlugin(env) {
  const ROUTES = new Set(['ping', 'preview', 'project-status', 'sync'])
  return {
    name: 'odoo-api-dev',
    apply: 'serve',
    configureServer(server) {
      // Rendre les variables Odoo (du .env) visibles aux handlers via process.env
      for (const k of ['ODOO_URL', 'ODOO_DB', 'ODOO_LOGIN', 'ODOO_KEY']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/odoo/')) return next()
        const url = new URL(req.url, 'http://localhost')
        const route = url.pathname.replace('/api/odoo/', '').replace(/\/$/, '')
        if (!ROUTES.has(route)) return next()

        // Adapter la requête Node vers la signature (req, res) de Vercel
        const query = Object.fromEntries(url.searchParams.entries())
        let body
        if (req.method === 'POST') {
          body = await new Promise((resolve) => {
            let d = ''
            req.on('data', (c) => (d += c))
            req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch { resolve({}) } })
          })
        }
        const vreq = { method: req.method, query, body }
        const vres = {
          statusCode: 200,
          status(c) { this.statusCode = c; return this },
          json(obj) {
            res.statusCode = this.statusCode
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          },
        }
        try {
          const modUrl = new URL(`./api/odoo/${route}.js`, import.meta.url)
          const handler = (await import(modUrl.href)).default
          await handler(vreq, vres)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: e.message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false, // utilise public/manifest.json existant
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MiB (bundle ~6 MiB avec AG Grid Enterprise)
        },
      }),
      odooApiDevPlugin(env),
    ],
  }
})
