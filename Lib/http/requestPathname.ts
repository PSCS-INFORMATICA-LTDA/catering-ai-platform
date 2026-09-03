import { headers } from 'next/headers'

/** Pathname forwarded by proxy/middleware. Never used for authorization. */
export async function getRequestPathname(): Promise<string> {
  const headerStore = await headers()
  const pathname = headerStore.get('x-pathname')?.trim()
  return pathname || '/'
}
