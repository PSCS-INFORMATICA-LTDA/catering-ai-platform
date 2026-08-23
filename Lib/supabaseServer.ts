import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { supabase } from './supabase'

let adminClient: SupabaseClient | null = null

/** Cliente Supabase para RPC/server — usa service role quando disponível. */
export function getSupabaseServerClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    return supabase
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (url && serviceKey) {
    if (!adminClient) {
      adminClient = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    }
    return adminClient
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[supabaseServer] service role missing; using anon client')
  }
  return supabase
}
