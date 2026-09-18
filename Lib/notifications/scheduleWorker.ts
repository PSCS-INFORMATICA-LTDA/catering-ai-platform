import { after } from 'next/server'

let scheduled = false

export function scheduleNotificationWorker() {
  if (scheduled) return
  scheduled = true
  const run = async () => {
    scheduled = false
    try {
      const { processNotificationQueue } = await import('./processDeliveryQueue')
      await processNotificationQueue({ limit: 20, reason: 'after_enqueue' })
    } catch (error) {
      console.warn('[notifications] worker kick failed', {
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
  try {
    after(() => {
      void run()
    })
  } catch {
    void run()
  }
}
