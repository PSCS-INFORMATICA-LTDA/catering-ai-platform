import AgendaDashboard from '@/components/agenda/AgendaDashboard'
import type { AgendaEvent, OperationalTeam } from '@/Lib/agenda/types'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import {
  startOfWeekMondayFromDayKey,
  todayDayKey,
  toDayKey,
  weekDayKeys,
} from '@/Lib/agenda/week'
import { tAgenda } from '@/Lib/i18n/agenda'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { hydrateTeamsWithContacts } from '@/Lib/teamContacts'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AgendaPage() {
  const session = await getAuthSession()
  if (!session) redirect('/login?next=/agenda')

  const companyId = resolveAuthorizedCompanyId(session)
  const todayKey = todayDayKey()
  const weekStart = startOfWeekMondayFromDayKey(todayKey)
  const keys = weekDayKeys(weekStart)
  const db = getSupabaseServerClient()

  const [teamsRes, eventsRes] = await Promise.all([
    db
      .from('operational_teams')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name', { ascending: true }),
    db
      .from('agenda_events')
      .select('*')
      .eq('company_id', companyId)
      .gte('event_date', keys[0]!)
      .lte('event_date', keys[6]!)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  if (teamsRes.error || eventsRes.error) {
    const locale = resolveAuthLocale(session.appUser?.preferred_language)
    const message =
      teamsRes.error?.message ||
      eventsRes.error?.message ||
      tAgenda(locale, 'genericError')
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">
          {tAgenda(locale, 'pageLoadError')}
        </h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {message}
        </pre>
        <p className="mt-4 text-sm text-cdl-muted">
          {tAgenda(locale, 'migrationHint')}
        </p>
      </main>
    )
  }

  const teams = await hydrateTeamsWithContacts(
    (teamsRes.data ?? []) as OperationalTeam[],
    companyId,
  )

  return (
    <AgendaDashboard
      initialTeams={teams}
      initialEvents={(eventsRes.data ?? []) as AgendaEvent[]}
      initialWeekStart={toDayKey(weekStart)}
    />
  )
}
