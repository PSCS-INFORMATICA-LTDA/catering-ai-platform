import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('get_public_team_member_confirmation', {
    p_token: token,
  })
  if (error) {
    return Response.json({ found: false, error: error.message }, { status: 500 })
  }
  return Response.json(data ?? { found: false })
}

export async function POST(request: Request, context: Ctx) {
  const { token } = await context.params
  let body: { response?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  const response =
    body.response === 'confirmed' || body.response === 'declined'
      ? body.response
      : null
  if (!response) {
    return Response.json({ ok: false, error: 'invalid_response' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('respond_to_team_member_confirmation', {
    p_token: token,
    p_response: response,
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  return Response.json(data ?? { ok: false })
}
