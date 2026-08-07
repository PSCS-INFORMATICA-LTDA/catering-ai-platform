import PublicSupplierGarnishClient from './PublicSupplierGarnishClient'
import { GET as getPublicSupplierGarnish } from '@/app/api/public/confirmacao-guarnicao/[token]/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicSupplierGarnishPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await getPublicSupplierGarnish(
    new Request(`http://local/api/public/confirmacao-guarnicao/${token}`),
    { params: Promise.resolve({ token }) },
  )
  const payload = (await res.json()) as {
    found?: boolean
    company_name?: string
    supplier_garnish_response?: string
    can_respond?: boolean
    order?: Record<string, unknown>
  }

  if (!payload.found || !payload.order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">
            Pedido não encontrado
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            O link pode estar incompleto ou o pedido foi cancelado.
          </p>
        </div>
      </main>
    )
  }

  return (
    <PublicSupplierGarnishClient
      token={token}
      companyName={payload.company_name || 'BBQ At Home'}
      initialResponse={payload.supplier_garnish_response || 'pending'}
      canRespond={Boolean(payload.can_respond)}
      order={payload.order as never}
    />
  )
}
