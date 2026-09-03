function isDevInstrumentationEnabled() {
  return process.env.NODE_ENV !== 'production'
}

/** DEV-only structured timing. Never log tokens, cookies, or customer fields. */
export function logDevServerTiming(
  route: string,
  marks: Record<string, number | string | boolean | null | undefined>,
) {
  if (!isDevInstrumentationEnabled()) return
  console.info('[server-timing]', {
    route,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    ...marks,
  })
}
