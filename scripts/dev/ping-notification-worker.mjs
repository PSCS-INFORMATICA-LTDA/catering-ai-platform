/**
 * Manual DEV ping. Does not print secrets.
 *   NOTIFICATION_WORKER_URL=... NOTIFICATION_WORKER_SECRET=... node scripts/dev/ping-notification-worker.mjs
 */
const url = String(process.env.NOTIFICATION_WORKER_URL || '').trim()
const secret = String(
  process.env.NOTIFICATION_WORKER_SECRET || process.env.CRON_SECRET || '',
).trim()

if (!url || !secret) {
  console.log(JSON.stringify({ pinged: false, reason: 'missing_url_or_secret' }))
  process.exit(0)
}
if (/prod|production|catering-ai-agenda\.vercel\.app/i.test(url)) {
  console.log(JSON.stringify({ pinged: false, reason: 'refused_production_url' }))
  process.exit(1)
}

const response = await fetch(url, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${secret}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ reason: 'manual_dev_ping' }),
})
console.log(JSON.stringify({ pinged: true, status: response.status }))
if (!response.ok) process.exitCode = 1
