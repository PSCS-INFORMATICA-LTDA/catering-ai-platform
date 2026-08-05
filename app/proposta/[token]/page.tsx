import PublicProposalClient from './PublicProposalClient'
import { GET as getPublicProposal } from '@/app/api/public/proposta/[token]/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await getPublicProposal(
    new Request(`http://local/api/public/proposta/${token}`),
    { params: Promise.resolve({ token }) },
  )
  const payload = (await res.json()) as {
    found?: boolean
    company_name?: string
    proposal_response?: string
    can_respond?: boolean
    quote?: Record<string, unknown>
  }

  if (!payload.found || !payload.quote) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">Proposta não encontrada</h1>
          <p className="mt-2 text-sm text-cdl-muted">
            O link pode estar incompleto ou a cotação foi desativada.
          </p>
        </div>
      </main>
    )
  }

  return (
    <PublicProposalClient
      token={token}
      companyName={payload.company_name || 'BBQ At Home'}
      initialResponse={payload.proposal_response || 'pending'}
      canRespond={Boolean(payload.can_respond)}
      quote={payload.quote as never}
    />
  )
}
