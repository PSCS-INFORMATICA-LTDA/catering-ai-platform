import { requireAnyApiPermission, requireSessionCompanyId } from '@/Lib/auth/requireApi'
import { maskPhone } from '@/Lib/notifications/maskPhone'
import { customerMatchesSearch } from '@/Lib/searchCustomers'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAnyApiPermission('notifications.manage', 'customers.view')
  if (!auth.ok) return auth.response
  const company = requireSessionCompanyId(auth.session)
  if (!company.ok) return company.response
  const query = new URL(request.url).searchParams.get('q')?.trim() || ''
  if (query.length < 2) return Response.json({ data: [] })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('customers')
    .select('id, full_name, ab_name, contact_name, phone, phone_normalized, preferred_language')
    .eq('company_id', company.companyId)
    .eq('active', true)
    .limit(80)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const matches = (data ?? [])
    .filter((row) =>
      customerMatchesSearch(
        {
          id: row.id,
          full_name: row.full_name,
          ab_name: row.ab_name,
          contact_name: row.contact_name,
          phone: row.phone,
          phone_normalized: row.phone_normalized,
        },
        query,
      ),
    )
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      displayName: row.full_name || row.ab_name || row.contact_name || '—',
      phoneMasked: maskPhone(row.phone_normalized || row.phone),
      phone: row.phone || row.phone_normalized || '',
      locale:
        row.preferred_language === 'en' || row.preferred_language === 'es'
          ? row.preferred_language
          : 'pt',
    }))

  return Response.json({ data: matches })
}
