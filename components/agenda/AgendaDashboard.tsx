'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import AppMainNav from '@/components/AppMainNav'
import type { AgendaEvent, OperationalTeam } from '@/Lib/agenda/types'
import { eventsToSegments } from '@/Lib/agenda/segments'
import {
  dayLabel,
  formatMinutes,
  shiftWeek,
  startOfWeekMonday,
  toDayKey,
  weekDayKeys,
} from '@/Lib/agenda/week'
import { glassBtn, glassField, glassTabLink } from '@/Lib/liquidGlass'

type Selection = { teamId: string; dayKey: string } | null

type FormState = {
  team_id: string
  title: string
  client_name: string
  event_date: string
  start_time: string
  end_time: string
  notes: string
}

function emptyForm(teamId = '', dayKey = ''): FormState {
  return {
    team_id: teamId,
    title: '',
    client_name: '',
    event_date: dayKey || toDayKey(new Date()),
    start_time: '10:00',
    end_time: '14:00',
    notes: '',
  }
}

export default function AgendaDashboard({
  initialTeams,
  initialEvents,
  initialWeekStart,
}: {
  initialTeams: OperationalTeam[]
  initialEvents: AgendaEvent[]
  initialWeekStart: string
}) {
  const [teams] = useState(initialTeams)
  const [events, setEvents] = useState(initialEvents)
  const [weekStart, setWeekStart] = useState(() => parseDay(initialWeekStart))
  const [teamFilter, setTeamFilter] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const weekKeys = useMemo(() => weekDayKeys(weekStart), [weekStart])
  const segments = useMemo(() => eventsToSegments(events), [events])

  const visibleTeams = useMemo(() => {
    if (!teamFilter) return teams
    return teams.filter((t) => t.id === teamFilter)
  }, [teams, teamFilter])

  const reload = useCallback(
    async (nextWeek: Date) => {
      setLoading(true)
      setError(null)
      try {
        const keys = weekDayKeys(nextWeek)
        const params = new URLSearchParams({
          from: keys[0]!,
          to: keys[6]!,
        })
        if (teamFilter) params.set('team_id', teamFilter)
        const res = await fetch(`/api/agenda/events?${params}`, { cache: 'no-store' })
        const json = (await res.json()) as { data?: AgendaEvent[]; error?: string }
        if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar agenda')
        setEvents(json.data ?? [])
        setWeekStart(nextWeek)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro')
      } finally {
        setLoading(false)
      }
    },
    [teamFilter],
  )

  async function createEvent() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/agenda/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao criar evento')
      setShowForm(false)
      setForm(emptyForm())
      await reload(weekStart)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function markStatus(id: string, status: 'completed' | 'cancelled' | 'scheduled') {
    setError(null)
    const res = await fetch(`/api/agenda/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(json.error ?? 'Falha ao atualizar')
      return
    }
    await reload(weekStart)
  }

  const selectedSegs = useMemo(() => {
    if (!selection) return []
    return segments
      .filter((s) => s.teamId === selection.teamId && s.dayKey === selection.dayKey)
      .sort((a, b) => a.startMin - b.startMin)
  }, [segments, selection])

  const selectedTeam = selection
    ? teams.find((t) => t.id === selection.teamId)
    : null

  return (
    <main className="min-h-screen bg-cdl-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <AppMainNav />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-600 sm:text-4xl">
              Agenda de eventos
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Quadro semanal por equipe — análogo à Agenda da Frota do Logistics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/teams" className={glassBtn('secondary')}>
              Gerenciar equipes
            </Link>
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={teams.length === 0}
              onClick={() => {
                setForm(
                  emptyForm(
                    selection?.teamId || teams[0]?.id || '',
                    selection?.dayKey || toDayKey(new Date()),
                  ),
                )
                setShowForm(true)
              }}
            >
              Novo evento
            </button>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="liquid-glass-card p-6 text-sm text-cdl-muted">
            Cadastre ao menos uma equipe em{' '}
            <Link href="/teams" className="underline">
              Equipes
            </Link>{' '}
            para montar a agenda.
          </div>
        ) : null}

        <div className="liquid-glass-panel flex flex-wrap items-end gap-3">
          <button
            type="button"
            className={glassTabLink(false)}
            onClick={() => void reload(shiftWeek(weekStart, -1))}
          >
            ← Semana
          </button>
          <button
            type="button"
            className={glassTabLink(false)}
            onClick={() => void reload(startOfWeekMonday(new Date()))}
          >
            Hoje
          </button>
          <button
            type="button"
            className={glassTabLink(false)}
            onClick={() => void reload(shiftWeek(weekStart, 1))}
          >
            Semana →
          </button>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-cdl-muted">
            Equipe
            <select
              className={glassField(false)}
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value)
                void (async () => {
                  const next = weekStart
                  const keys = weekDayKeys(next)
                  const params = new URLSearchParams({
                    from: keys[0]!,
                    to: keys[6]!,
                  })
                  if (e.target.value) params.set('team_id', e.target.value)
                  const res = await fetch(`/api/agenda/events?${params}`, {
                    cache: 'no-store',
                  })
                  const json = (await res.json()) as { data?: AgendaEvent[] }
                  setEvents(json.data ?? [])
                })()
              }}
            >
              <option value="">Todas</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm text-cdl-muted">
            {dayLabel(weekKeys[0]!)} — {dayLabel(weekKeys[6]!)}
            {loading ? ' · atualizando…' : ''}
          </span>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex flex-wrap gap-3 text-xs text-cdl-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-sky-300 bg-sky-100" />
            Agendado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-dashed border-slate-300 bg-slate-100" />
            Concluído
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-emerald-200 bg-emerald-50" />
            Livre
          </span>
        </div>

        <div className="schedule-day-board overflow-auto rounded-2xl border border-cdl-border bg-cdl-surface">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[10rem] border-b border-r border-cdl-border bg-cdl-surface px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-cdl-muted">
                  Equipe
                </th>
                {weekKeys.map((key) => (
                  <th
                    key={key}
                    className="min-w-[7.5rem] border-b border-cdl-border px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-cdl-muted"
                  >
                    {dayLabel(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((team) => (
                <tr key={team.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-cdl-border bg-cdl-surface px-3 py-2 align-top">
                    <div className="flex items-center gap-2 font-semibold text-cdl-fg">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: team.color }}
                      />
                      {team.name}
                    </div>
                  </td>
                  {weekKeys.map((dayKey) => {
                    const cellSegs = segments
                      .filter((s) => s.teamId === team.id && s.dayKey === dayKey)
                      .sort((a, b) => a.startMin - b.startMin)
                    const selected =
                      selection?.teamId === team.id && selection.dayKey === dayKey
                    return (
                      <td
                        key={dayKey}
                        className={`border-b border-cdl-border p-1.5 align-top ${
                          selected ? 'bg-sky-500/10 ring-2 ring-inset ring-sky-400/50' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-h-[4.5rem] w-full flex-col gap-1 rounded-lg p-1 text-left hover:bg-cdl-hover"
                          onClick={() => {
                            setSelection({ teamId: team.id, dayKey })
                            setForm(emptyForm(team.id, dayKey))
                          }}
                        >
                          {cellSegs.length === 0 ? (
                            <span className="rounded-md border border-emerald-200/60 bg-emerald-50/80 px-2 py-1 text-[0.7rem] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                              Livre o dia
                            </span>
                          ) : (
                            cellSegs.map((seg) => (
                              <span
                                key={seg.eventId}
                                className={`block rounded-md border px-1.5 py-1 text-[0.68rem] leading-tight ${
                                  seg.isHistorical
                                    ? 'border-dashed border-slate-300 bg-slate-100 text-slate-600'
                                    : 'border-sky-300 bg-sky-100 text-sky-900'
                                }`}
                                title={seg.title}
                              >
                                <span className="block font-semibold tabular-nums">
                                  {formatMinutes(seg.startMin)}–{formatMinutes(seg.endMin)}
                                </span>
                                <span className="block truncate font-medium">{seg.code}</span>
                              </span>
                            ))
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selection && selectedTeam ? (
          <div className="liquid-glass-card space-y-3 p-5">
            <h2 className="text-lg font-bold text-cdl-fg">
              {selectedTeam.name} · {dayLabel(selection.dayKey)}
            </h2>
            {selectedSegs.length === 0 ? (
              <p className="text-sm text-cdl-muted">Nenhum evento neste dia.</p>
            ) : (
              <ul className="space-y-2">
                {selectedSegs.map((seg) => (
                  <li
                    key={seg.eventId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2 text-sm"
                  >
                    <div>
                      <strong className="tabular-nums">
                        {formatMinutes(seg.startMin)}–{formatMinutes(seg.endMin)}
                      </strong>{' '}
                      · {seg.code} · {seg.title}
                      {seg.clientName ? (
                        <span className="text-cdl-muted"> · {seg.clientName}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {seg.status === 'scheduled' ? (
                        <>
                          <button
                            type="button"
                            className={glassBtn('secondary', 'liquid-glass-tab-link--plain')}
                            onClick={() => void markStatus(seg.eventId, 'completed')}
                          >
                            Concluir
                          </button>
                          <button
                            type="button"
                            className={glassBtn('ghost', 'liquid-glass-tab-link--plain')}
                            onClick={() => void markStatus(seg.eventId, 'cancelled')}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className={glassBtn('primary')}
              onClick={() => {
                setForm(emptyForm(selection.teamId, selection.dayKey))
                setShowForm(true)
              }}
            >
              Novo evento neste horário
            </button>
          </div>
        ) : null}

        {showForm ? (
          <div className="liquid-glass-card space-y-4 p-5">
            <h2 className="text-lg font-bold">Novo evento</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-cdl-muted">Equipe</span>
                <select
                  className={glassField(true)}
                  value={form.team_id}
                  onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-cdl-muted">Título</span>
                <input
                  className={glassField(true)}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-cdl-muted">Cliente</span>
                <input
                  className={glassField(false)}
                  value={form.client_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, client_name: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-cdl-muted">Data</span>
                <input
                  type="date"
                  className={glassField(true)}
                  value={form.event_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, event_date: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-cdl-muted">Início</span>
                <input
                  type="time"
                  className={glassField(true)}
                  value={form.start_time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start_time: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-cdl-muted">Fim</span>
                <input
                  type="time"
                  className={glassField(true)}
                  value={form.end_time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_time: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-cdl-muted">Notas</span>
                <input
                  className={glassField(false)}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={glassBtn('primary')}
                disabled={saving || !form.title.trim() || !form.team_id}
                onClick={() => void createEvent()}
              >
                {saving ? 'Salvando…' : 'Salvar evento'}
              </button>
              <button
                type="button"
                className={glassBtn('secondary')}
                onClick={() => setShowForm(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

function parseDay(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0)
}
