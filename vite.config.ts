import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const AUDIO_TYPES: Record<string, string> = { '.m4a': 'audio/mp4', '.json': 'application/json' }

/**
 * Serves stations/ during development, with Range requests so the browser can seek into a
 * song. In production it's just a folder of static files next to the build.
 */
function stations(): Plugin {
  return {
    name: 'stations',
    configureServer(server) {
      server.middlewares.use('/stations', (req, res, next) => {
        const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname))
        if (path.includes('..')) return next()
        const file = join(server.config.root, 'stations', path)
        let size: number
        try {
          size = statSync(file).size
        } catch {
          return next()
        }
        const headers: Record<string, string | number> = {
          'Content-Type': AUDIO_TYPES[extname(file)] ?? 'application/octet-stream',
          'Accept-Ranges': 'bytes',
        }
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
        if (range) {
          const start = range[1] ? Number(range[1]) : size - Number(range[2])
          const end = range[1] && range[2] ? Number(range[2]) : size - 1
          res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
          createReadStream(file, { start, end }).pipe(res)
        } else {
          res.writeHead(200, { ...headers, 'Content-Length': size })
          createReadStream(file).pipe(res)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Where the site is served from, e.g. "/los-santos-radio/" on GitHub Pages (see .github/workflows/deploy.yml).
  base: process.env.BASE_PATH || '/',
  plugins: [react(), stations()],
})
