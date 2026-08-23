import PublicTeamAssignmentClient from './PublicTeamAssignmentClient'
import { GET as getPublicTeamAssignment } from '@/app/api/public/designacao-equipe/[token]/route'
import { headers } from 'next/headers'
import { resolveBrowserLocale, tPublicOps } from '@/Lib/i18n/publicOps'

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

  const lang = resolveBrowserLocale(
    (await headers()).get('accept-language'),
  )

  if (!payload.found || !payload.assignment) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="liquid-glass-card p-8 text-center">
          <h1 className="text-xl font-bold text-cdl-fg">
            {tPublicOps(lang, 'assignmentNotFound')}
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            {tPublicOps(lang, 'assignmentNotFoundHint')}
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
      language={lang}
    />
  )
}
