import { requireApiAuth, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { fetchTenantContext } from '@/Lib/tenant/fetchTenantContext'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  try {
    const companyId = resolveAuthorizedCompanyId(auth.session)
    const branchId = auth.session.activeMembership?.branch_id ?? null
    const role = auth.session.activeMembership?.role ?? null
    const context = await fetchTenantContext({ companyId, branchId, role })
    return Response.json(
      { data: context },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar contexto do tenant.',
      },
      { status: 500 },
    )
  }
}
