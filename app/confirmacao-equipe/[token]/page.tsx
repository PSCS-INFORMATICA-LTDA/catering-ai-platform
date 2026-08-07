import PublicTeamMemberConfirmClient from './PublicTeamMemberConfirmClient'
import { GET as getPublicConfirm } from '@/app/api/public/confirmacao-equipe/[token]/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicTeamMemberConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await getPublicConfirm(
    new Request(`http://local/api/public/confirmacao-equipe/${token}`),
    { params: Promise.resolve({ token }) },
  )
  const payload = (await res.json()) as {
    found?: boolean
    expired?: boolean
    company_name?: string
    status?: string
    can_respond?: boolean
    confirmation?: Record<string, unknown>
  }

  if (!payload.found || !payload.confirmation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">
            Confirmação não encontrada
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            O link pode estar incompleto, expirado ou revogado.
          </p>
        </div>
      </main>
    )
  }

  if (payload.expired) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">Link expirado</h1>
          <p className="mt-2 text-sm text-cdl-muted">
            Solicite um novo convite à operação.
          </p>
        </div>
      </main>
    )
  }

  return (
    <PublicTeamMemberConfirmClient
      token={token}
      companyName={payload.company_name || 'Catering'}
      initialStatus={payload.status || 'pending'}
      canRespond={Boolean(payload.can_respond)}
      confirmation={payload.confirmation as never}
    />
  )
}
