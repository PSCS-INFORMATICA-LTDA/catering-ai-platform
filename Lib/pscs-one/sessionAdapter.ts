import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { createClient } from '@/Lib/supabase/server'
import type { PscsOneIdentityV1 } from './types'

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof getSupabaseServerClient>,
  email: string,
): Promise<string | null> {
  const { data } = await admin
    .from('app_users')
    .select('auth_user_id')
    .eq('email', email)
    .maybeSingle()
  if (data?.auth_user_id) return String(data.auth_user_id)

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const match = listed.data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  )
  return match?.id ?? null
}

export class PscsOneSessionAdapter {
  static async establishSession(identity: PscsOneIdentityV1): Promise<string> {
    const email = identity.email?.trim().toLowerCase()
    if (!email) {
      throw new Error('identity_email_missing')
    }

    const admin = getSupabaseServerClient()

    const { data: linked } = await admin
      .from('app_users')
      .select('auth_user_id, email')
      .eq('pscs_one_user_id', identity.user_id)
      .maybeSingle()

    let authUserId = linked?.auth_user_id ? String(linked.auth_user_id) : null

    if (!authUserId) {
      const byEmail = await findAuthUserIdByEmail(admin, email)
      if (byEmail) {
        authUserId = byEmail
      } else {
        const created = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            pscs_one_user_id: identity.user_id,
            source: 'pscs_one_sso',
          },
        })
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message || 'create_user_failed')
        }
        authUserId = created.data.user.id
      }
    }

    const { data: appUser } = await admin
      .from('app_users')
      .select('id, email, pscs_one_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (appUser?.pscs_one_user_id && appUser.pscs_one_user_id !== identity.user_id) {
      throw new Error('identity_conflict')
    }

    if (appUser) {
      const { error } = await admin
        .from('app_users')
        .update({
          pscs_one_user_id: identity.user_id,
          email,
          active: true,
        })
        .eq('auth_user_id', authUserId)
      if (error) throw new Error(error.message)
    } else {
      const display = email.split('@')[0] || 'User'
      const { error } = await admin.from('app_users').insert({
        auth_user_id: authUserId,
        email,
        full_name: display,
        display_name: display,
        preferred_language: 'pt',
        is_pscs_master: false,
        active: true,
        pscs_one_user_id: identity.user_id,
      })
      if (error) throw new Error(error.message)
    }

    const link = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const tokenHash = link.data.properties?.hashed_token
    if (link.error || !tokenHash) {
      throw new Error(link.error?.message || 'session_link_failed')
    }

    const supabase = await createClient()
    const verified = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    })
    if (verified.error) {
      throw new Error(verified.error.message)
    }

    return authUserId
  }
}
