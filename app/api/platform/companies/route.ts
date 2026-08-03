import { getAuthSession } from '@/Lib/auth/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export async function GET() {
  const session = await getAuthSession()
  if (!session?.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseServerClient()
  const { data, error } = await admin
    .from('companies')
    .select('id, company_name, slug, active')
    .order('company_name')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    data: (data ?? []).map((c) => ({
      id: c.id,
      name: c.company_name,
      slug: c.slug,
      active: c.active,
    })),
  })
}
