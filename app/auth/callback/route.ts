import { acceptPendingInvite } from '@/Lib/auth/acceptInvite'
import { safeInternalNext } from '@/Lib/auth/safeNext'
import { createClient } from '@/Lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const authType = searchParams.get('type')
  const defaultNext = authType === 'invite' ? '/quotes' : '/auth/reset-password'
  const next = safeInternalNext(searchParams.get('next'), defaultNext)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        await acceptPendingInvite({
          authUserId: user.id,
          email: user.email,
          displayName:
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            null,
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
