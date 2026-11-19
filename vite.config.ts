import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";
import { aggregateJobRadar } from "./server/job-radar/aggregator";
import type { JobMarket } from "./server/job-radar/types";
import { executeLlmWithRotation, resolveServerApiKeys } from "./server/llm/groq-client";

const projectRoot = process.env.PROJECT_ROOT || dirname(fileURLToPath(import.meta.url))

/**
 * Server-side /api/llm middleware with automatic Groq key rotation (never exposes keys to browser).
 */
function kovaLlmApiPlugin(env: Record<string, string | undefined>): Plugin {
  const baseUrl = env.LLM_BASE_URL || 'https://api.groq.com/openai/v1'
  const apiKeys = resolveServerApiKeys(env)
  const defaultModel = env.LLM_MODEL_DEFAULT || 'openai/gpt-oss-120b'
  const systemPrompt = env.LLM_SYSTEM_PROMPT || 'You are a helpful recruitment and career analyst.'

  const handleLlm = async (req: any, res: any) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method Not Allowed' }))
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)

    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
      const result = await executeLlmWithRotation(body, {
        baseUrl,
        apiKeys,
        defaultModel,
        systemPrompt,
      })
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(result))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'LLM request failed'
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: message }))
    }
  }

  return {
    name: 'kova-llm-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', handleLlm)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/llm', handleLlm)
    },
  }
}

/**
 * Job Radar middleware serving live aggregated offers on /api/job-radar in both dev and preview.
 */
function jobRadarPlugin(): Plugin {
  const handleRadar = async (req: any, res: any) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method Not Allowed' }))
      return
    }

    try {
      const parsed = new URL(req.url || '/', 'http://localhost')
      const rawMarket = parsed.searchParams.get('market') || 'all'
      const market: 'all' | JobMarket =
        rawMarket === 'ci_africa' || rawMarket === 'tech_remote' ? rawMarket : 'all'
      const query = (parsed.searchParams.get('q') || '').slice(0, 120)
      const refresh = parsed.searchParams.get('refresh') === '1'

      const payload = await aggregateJobRadar({ market, query, refresh })
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(payload))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Job Radar error'
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: message }))
    }
  }

  return {
    name: 'kova-job-radar',
    configureServer(server) {
      server.middlewares.use('/api/job-radar', handleRadar)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/job-radar', handleRadar)
    },
  }
}

/**
 * Custom Vite plugin that proxies /llm-proxy/* to the LLM API using native
 * Node.js https module. This avoids http-proxy chunked encoding issues that
 * caused ERR_INCOMPLETE_CHUNKED_ENCODING with long DeepSeek responses.
 */
function llmProxyPlugin(llmBaseUrl: string): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use('/llm-proxy', async (req, res) => {
        const base = llmBaseUrl.replace(/\/+$/, '')
        const subPath = req.url ?? '/'
        const targetUrl = base + subPath

        // Collect incoming request body
        const bodyChunks: Buffer[] = []
        for await (const chunk of req) bodyChunks.push(chunk as Buffer)
        const body = Buffer.concat(bodyChunks)

        const authHeader = req.headers['authorization'] || ''
        console.log(`[llm-proxy] POST ${targetUrl} (${body.length} bytes)`)

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 60_000)

        try {
          // Use Node.js native fetch — handles TLS, compression, chunked encoding correctly
          const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body,
            signal: controller.signal,
          })

          clearTimeout(timer)

          const responseBody = await upstream.text()
          console.log(`[llm-proxy] Response: ${upstream.status} (${responseBody.length} chars)`)

          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Content-Length': Buffer.byteLength(responseBody).toString(),
          })
          res.end(responseBody)
        } catch (err: any) {
          clearTimeout(timer)
          const message = err.name === 'AbortError'
            ? 'LLM proxy timeout after 60s'
            : `Proxy error: ${err.message}`
          console.error(`[llm-proxy] ${message}`)
          if (!res.headersSent) {
            res.writeHead(err.name === 'AbortError' ? 504 : 502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: message }))
          }
        }
      })
    },
  }
}

/**
 * OCR proxy plugin — handles /api/ocr directly when Netlify Dev is not running.
 * Forwards requests to OCR.space API, handling FormData multipart encoding.
 */
function ocrProxyPlugin(ocrApiKey: string, ocrEndpoint: string): Plugin {
  return {
    name: 'ocr-proxy',
    configureServer(server) {
      // Intercept /api/ocr BEFORE the /api proxy (which targets localhost:8888)
      server.middlewares.use('/api/ocr', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }

        // Collect body
        const bodyChunks: Buffer[] = []
        for await (const chunk of req) bodyChunks.push(chunk as Buffer)
        const rawBody = Buffer.concat(bodyChunks).toString('utf-8')

        console.log(`[ocr-proxy] Request received (${rawBody.length} bytes)`)

        try {
          const { dataUrl, ocrEngine, language } = JSON.parse(rawBody) as {
            dataUrl?: string
            base64?: string
            ocrEngine?: number
            language?: string
          }

          const imageData = dataUrl || ''
          if (!imageData) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Missing dataUrl' }))
            return
          }

          // Build FormData for OCR.space
          const form = new FormData()
          form.append('base64Image', imageData)
          form.append('language', language || 'fre')
          form.append('OCREngine', String(ocrEngine ?? 2))
          form.append('isOverlayRequired', 'false')

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 45_000)

          const upstream = await fetch(ocrEndpoint, {
            method: 'POST',
            headers: {
              apikey: ocrApiKey,
            },
            body: form,
            signal: controller.signal,
          })

          clearTimeout(timer)

          const upstreamText = await upstream.text()
          console.log(`[ocr-proxy] Response: ${upstream.status} (${upstreamText.length} chars)`)

          if (!upstream.ok) {
            res.writeHead(upstream.status, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(JSON.stringify({ error: 'OCR request failed', details: upstreamText }))
            return
          }

          const data = JSON.parse(upstreamText) as any

          if (data?.IsErroredOnProcessing) {
            res.writeHead(502, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(JSON.stringify({
              error: 'OCR processing error',
              message: data?.ErrorMessage ?? 'Unknown OCR error',
            }))
            return
          }

          const parsedResults = Array.isArray(data?.ParsedResults) ? data.ParsedResults : []
          const text = parsedResults
            .map((r: any) => (typeof r?.ParsedText === 'string' ? r.ParsedText : ''))
            .filter(Boolean)
            .join('\n')
            .trim()

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify({
            text,
            ocrExitCode: data?.OCRExitCode ?? null,
            processingTimeMs: data?.ProcessingTimeInMilliseconds ?? null,
          }))
        } catch (err: any) {
          const message = err.name === 'AbortError'
            ? 'OCR proxy timeout after 45s'
            : `OCR proxy error: ${err.message}`
          console.error(`[ocr-proxy] ${message}`)
          if (!res.headersSent) {
            res.writeHead(err.name === 'AbortError' ? 504 : 502, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(JSON.stringify({ error: message }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, projectRoot, '')

  // Direct proxy to LLM API for dev (bypasses Netlify Function 30s timeout)
  const llmBaseUrl = env.LLM_BASE_URL || 'https://api.deepseek.com/v1'
  const ocrApiKey = env.OCR_SPACE_API_KEY || ''
  const ocrEndpoint = env.OCR_SPACE_ENDPOINT || 'https://api.ocr.space/parse/image'

  const plugins: Plugin[] = [
    react(),
    tailwindcss(),
    llmProxyPlugin(llmBaseUrl),
    kovaLlmApiPlugin(env),
    jobRadarPlugin(),
  ]

  // Only add OCR proxy in dev (not needed in build)
  if (command === 'serve' && ocrApiKey) {
    plugins.push(ocrProxyPlugin(ocrApiKey, ocrEndpoint))
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src')
      }
    },
    server: {
      proxy: {
        // Python OCR backend (PaddleOCR — free, offline)
        '/api/ocr-python': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace('/api/ocr-python', ''),
        },
        // Netlify functions proxy (for when netlify dev is running)
        '/api': {
          target: `http://localhost:${env.NETLIFY_DEV_PORT || '8888'}`,
          changeOrigin: true,
        },
      },
    },
  }
})
