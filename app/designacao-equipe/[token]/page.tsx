import PublicTeamAssignmentClient from './PublicTeamAssignmentClient'
import { GET as getPublicTeamAssignment } from '@/app/api/public/designacao-equipe/[token]/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicTeamAssignmentPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await getPublicTeamAssignment(
    new Request(`http://local/api/public/designacao-equipe/${token}`),
    { params: Promise.resolve({ token }) },
  )
  const payload = (await res.json()) as {
    found?: boolean
    company_name?: string
    team_assignment_response?: string
    can_respond?: boolean
    assignment?: Record<string, unknown>
  }

  if (!payload.found || !payload.assignment) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">
            Designação não encontrada
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            O link pode estar incompleto ou a designação foi cancelada.
          </p>
        </div>
      </main>
    )
  }

  return (
    <PublicTeamAssignmentClient
      token={token}
      companyName={payload.company_name || 'BBQ At Home'}
      initialResponse={payload.team_assignment_response || 'pending'}
      canRespond={Boolean(payload.can_respond)}
      assignment={payload.assignment as never}
    />
  )
}
