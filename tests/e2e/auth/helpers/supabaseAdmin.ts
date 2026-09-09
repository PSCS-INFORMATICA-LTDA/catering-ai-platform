import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEV_SUPABASE_REF } from './constants'
import { assertDevSupabaseRef } from './guards'

let adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  assertDevSupabaseRef(url)

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return adminClient
}

export function getSupabaseRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? ''
}

export function assertDevEnvironment(): void {
  const ref = getSupabaseRef()
  if (ref !== DEV_SUPABASE_REF) {
    throw new Error(`Expected DEV ref ${DEV_SUPABASE_REF}, got ${ref}`)
  }
}
