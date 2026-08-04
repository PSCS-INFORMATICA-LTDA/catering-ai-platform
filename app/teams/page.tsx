import TeamsDashboard from '@/components/teams/TeamsDashboard'
import type { OperationalTeam } from '@/Lib/agenda/types'
import { getAuthSession } from '@/Lib/auth/session'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
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
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro ao carregar equipes</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
        <p className="mt-4 text-sm text-cdl-muted">
          Se a migration ainda não foi aplicada no DEV, rode
          `20260804120000_agenda_teams_events.sql`.
        </p>
      </main>
    )
  }

  return <TeamsDashboard initialTeams={(data ?? []) as OperationalTeam[]} />
}
