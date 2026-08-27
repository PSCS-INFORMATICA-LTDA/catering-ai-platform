/**
 * Cold/warm TTFB for DEV first access. Does not fabricate cookies.
 *
 *   npm run test:dev:quotes-first-access-v2:http
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = process.env.DEV_CANONICAL_URL || 'https://catering-ai-agenda-dev.vercel.app'
const QUOTE_ID = process.env.DEV_TEST_QUOTE_ID || '4750023f-0947-4f1e-a446-f9675cd44907'

async function timeGet(path) {
  const started = Date.now()
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: { 'cache-control': 'no-store' },
  })
  const totalMs = Date.now() - started
  return {
    path,
    status: response.status,
    totalMs,
    region: response.headers.get('x-vercel-id') || response.headers.get('x-vercel-cache') || null,
    cache: response.headers.get('x-vercel-cache'),
  }
}

function pct(values, p) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)))
  return sorted[idx]
}

const routes = ['/login', '/quotes', `/quotes/${QUOTE_ID}`]
const cold = []
const warm = []

for (const path of routes) {
  for (let i = 0; i < 5; i += 1) {
    cold.push({ kind: 'COLD', n: i + 1, ...(await timeGet(path)) })
  }
  for (let i = 0; i < 5; i += 1) {
    warm.push({ kind: 'WARM', n: i + 1, ...(await timeGet(path)) })
  }
}

function summarize(label, rows) {
  const totals = rows.map((row) => row.totalMs)
  return {
    label,
    count: rows.length,
    p50: pct(totals, 50),
    p95: pct(totals, 95),
    min: Math.min(...totals),
    max: Math.max(...totals),
  }
}

const report = {
  base: BASE,
  note: 'Unauthenticated requests. /quotes redirects to /login. Separate COLD-like and WARM series. Not a substitute for authenticated browser waterfall.',
  cold: summarize('COLD', cold),
  warm: summarize('WARM', warm),
  samples: [...cold, ...warm],
}

const out = join(ROOT, 'artifacts', 'quotes-first-access-v2-http.json')
try {
  writeFileSync(out, JSON.stringify(report, null, 2))
} catch {
  /* artifacts dir may be gitignored; still print */
}

console.log(JSON.stringify(report, null, 2))
