import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.CATERING_DEV_LOGIN_EMAIL
const adminPassword = process.env.CATERING_DEV_LOGIN_PASSWORD
const base = 'https://catering-ai-agenda-dev.vercel.app'

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: adminEmail, password: adminPassword }),
})
const loginJson = await login.json()
const token = loginJson.access_token
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1]
const cookie = `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify({
  access_token: token,
  refresh_token: loginJson.refresh_token,
  token_type: 'bearer',
  expires_in: loginJson.expires_in,
  expires_at: loginJson.expires_at,
}))}`

for (const email of [
  `pscs.solutions+catering.qa.probe.${Date.now()}@gmail.com`,
  `qa.auth.invite.probe.${Date.now()}@example.test`,
]) {
  const res = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, role: 'operator' }),
  })
  const json = await res.json()
  console.log('email=', email.split('@')[1], 'status=', res.status, 'error=', json.error || '-', 'inviteId=', json.inviteId || json.data?.id || '-')

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: invite } = await admin
    .from('user_invites')
    .select('id, status, revoked_at, email')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  console.log('  invite_row=', invite)

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const authUser = (list.data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
  console.log('  auth_user=', authUser ? { id: authUser.id, invited_at: authUser.invited_at, confirmed: authUser.email_confirmed_at } : null)

  // cleanup probe
  if (authUser?.id) await admin.auth.admin.deleteUser(authUser.id)
  if (invite?.id) await admin.from('user_invites').delete().eq('id', invite.id)
}

// direct supabase invite test
const testEmail = `qa.direct.invite.${Date.now()}@example.test`
const admin = createClient(url, service, { auth: { persistSession: false } })
const direct = await admin.auth.admin.inviteUserByEmail(testEmail, {
  redirectTo: `${base}/auth/callback?next=/quotes`,
})
console.log('direct_invite example.test error=', direct.error?.message || 'none')
if (direct.data?.user?.id) await admin.auth.admin.deleteUser(direct.data.user.id)
