import TeamsDashboard from '@/components/teams/TeamsDashboard'
import type { OperationalTeam } from '@/Lib/agenda/types'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { tTeams } from '@/Lib/i18n/teams'
import { hydrateTeamsWithContacts } from '@/Lib/teamContacts'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TeamsPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/teams')

  const companyId = resolveAuthorizedCompanyId(session)
  const { data, error } = await getSupabaseServerClient()
    .from('operational_teams')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    const locale = resolveAuthLocale(session.appUser?.preferred_language)
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">
          {tTeams(locale, 'pageLoadError')}
        </h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  const teams = await hydrateTeamsWithContacts(
    (data ?? []) as OperationalTeam[],
    companyId,
  )

  return <TeamsDashboard initialTeams={teams} />
}
