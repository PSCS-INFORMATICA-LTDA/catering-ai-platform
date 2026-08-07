'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import type { AgendaEvent, OperationalTeam } from '@/Lib/agenda/types'
import { eventsToSegments } from '@/Lib/agenda/segments'
import { teamHasBookingOnDate } from '@/Lib/agenda/teamAvailability'
import {
  AGENDA_MONTH_OPTIONS,
  buildAgendaQuoteHref,
  dayLabel,
  dayLabelParts,
  endOfMonth,
  formatMinutes,
  formatRangeLabel,
  formatWeekRangeLabel,
  inclusiveDaySpan,
  parseDayKey,
  shiftWeek,
  startOfMonth,
  toDayKey,
  todayDayKey,
  visibleWeekDayKeys,
  weekDayKeys,
} from '@/Lib/agenda/week'
import { glassBtn, glassField, glassTabLink } from '@/Lib/liquidGlass'
import TeamAvailabilitySharePanel from '@/components/agenda/TeamAvailabilitySharePanel'
import { buildPublicTeamAssignmentUrl } from '@/Lib/teamAssignment'

type Selection = { teamId: string; dayKey: string } | null
type RangeMode = 'week' | 'custom'

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
  /** Âncora da semana (qualquer dia), como no Logistics — weekDayKeys normaliza p/ segunda. */
  const [weekAnchor, setWeekAnchor] = useState(() =>
    parseDayKey(initialWeekStart),
  )
  const [teamFilter, setTeamFilter] = useState('')
  const [rangeMode, setRangeMode] = useState<RangeMode>('week')
  const initialKeys = weekDayKeys(parseDayKey(initialWeekStart))
  const [rangeFrom, setRangeFrom] = useState(initialKeys[0]!)
  const [rangeTo, setRangeTo] = useState(initialKeys[6]!)
  const [filterYear, setFilterYear] = useState(() =>
    parseDayKey(initialWeekStart).getFullYear(),
  )
  const [filterMonth, setFilterMonth] = useState(() =>
    parseDayKey(initialWeekStart).getMonth(),
  )
  const [selection, setSelection] = useState<Selection>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const todayKey = todayDayKey()
  const weekKeys = useMemo(
    () => visibleWeekDayKeys(weekAnchor, todayKey),
    [weekAnchor, todayKey],
  )
  const segments = useMemo(() => eventsToSegments(events), [events])

  const visibleTeams = useMemo(() => {
    if (!teamFilter) return teams
    return teams.filter((t) => t.id === teamFilter)
  }, [teams, teamFilter])

  const yearOptions = useMemo(() => {
    const y = Number(todayKey.slice(0, 4))
    return [y - 1, y, y + 1]
  }, [todayKey])

  const showPeriodList =
    rangeMode === 'custom' && inclusiveDaySpan(rangeFrom, rangeTo) > 7

  const periodEvents = useMemo(() => {
    if (!showPeriodList) return []
    return [...events].sort((a, b) => {
      const byDate = a.event_date.localeCompare(b.event_date)
      if (byDate !== 0) return byDate
      return String(a.start_time).localeCompare(String(b.start_time))
    })
  }, [events, showPeriodList])

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teams) map.set(t.id, t.name)
    return map
  }, [teams])

  const fetchEvents = useCallback(
    async (from: string, to: string, teamId: string) => {
      const params = new URLSearchParams({ from, to })
      if (teamId) params.set('team_id', teamId)
      const res = await fetch(`/api/agenda/events?${params}`, { cache: 'no-store' })
      const json = (await res.json()) as { data?: AgendaEvent[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar agenda')
      return json.data ?? []
    },
    [],
  )

  /** Navegação semanal — volta ao modo semana. */
  const reloadWeek = useCallback(
    async (nextAnchor: Date, teamId = teamFilter) => {
      setLoading(true)
      setError(null)
      try {
        const keys = weekDayKeys(nextAnchor)
        const from = keys[0]!
        const to = keys[6]!
        const data = await fetchEvents(from, to, teamId)
        setEvents(data)
        setWeekAnchor(nextAnchor)
        setRangeMode('week')
        setRangeFrom(from)
        setRangeTo(to)
        setFilterYear(nextAnchor.getFullYear())
        setFilterMonth(nextAnchor.getMonth())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro')
      } finally {
        setLoading(false)
      }
    },
    [fetchEvents, teamFilter],
  )

  /** Intervalo customizado (mês / de–até). Quadro mostra a semana do início. */
  const reloadCustom = useCallback(
    async (from: string, to: string, teamId = teamFilter) => {
      if (!from || !to || from > to) {
        setError('Informe um intervalo válido (De ≤ Até).')
        return
      }
      if (inclusiveDaySpan(from, to) > 366) {
        setError('Intervalo máximo: 366 dias.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await fetchEvents(from, to, teamId)
        const anchor = parseDayKey(from)
        setEvents(data)
        setWeekAnchor(anchor)
        setRangeMode('custom')
        setRangeFrom(from)
        setRangeTo(to)
        setFilterYear(anchor.getFullYear())
        setFilterMonth(anchor.getMonth())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro')
      } finally {
        setLoading(false)
      }
    },
    [fetchEvents, teamFilter],
  )

  async function markStatus(id: string, status: 'completed' | 'cancelled' | 'scheduled') {
    setError(null)
    const res = await fetch(`/api/agenda/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = (await res.json()) as {
      error?: string
      conflict?: {
        next_available_start?: string | null
        message_pt?: string
      }
    }
    if (!res.ok) {
      const base = json.conflict?.message_pt || json.error || 'Falha ao atualizar'
      const next = json.conflict?.next_available_start
      setError(next ? `${base} Próximo horário disponível: ${next}` : base)
      return
    }
    if (rangeMode === 'custom') {
      await reloadCustom(rangeFrom, rangeTo)
    } else {
      await reloadWeek(weekAnchor)
    }
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

  const selectionDayBusy = Boolean(
    selection &&
      teamHasBookingOnDate(events, selection.teamId, selection.dayKey),
  )

  const newQuoteHref = buildAgendaQuoteHref({
    eventDate: selection?.dayKey || todayDayKey(),
    startTime: '10:00',
    endTime: '14:00',
  })

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-600 sm:text-4xl">
              Agenda de eventos
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Quadro semanal por equipe — análogo à Agenda da Frota do Logistics.
              Eventos entram aqui após aceite do cliente e confirmação do sinal (30%) na cotação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/teams" className={glassBtn('secondary')}>
              Gerenciar equipes
            </Link>
            <Link href={newQuoteHref} className={glassBtn('primary')}>
              Nova cotação
            </Link>
          </div>
        </div>

        <div className="liquid-glass-card px-4 py-3 text-sm text-cdl-muted">
          Não crie evento “na mão” na agenda. Use{' '}
          <Link href="/quotes/new" className="font-medium underline">
            Nova cotação
          </Link>
          : cliente → evento (adultos/crianças) → pacote → adicionais → resumo.
          Com aceite do cliente e confirmação do sinal (30%) na cotação, a data fecha aqui ao designar a equipe.
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

        <div className="liquid-glass-panel flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              className={glassTabLink(false)}
              onClick={() => {
                setSelection(null)
                void reloadWeek(shiftWeek(weekAnchor, -1))
              }}
            >
              ← Semana anterior
            </button>
            <button
              type="button"
              className={glassTabLink(false)}
              onClick={() => {
                setSelection(null)
                void reloadWeek(parseDayKey(todayDayKey()))
              }}
            >
              Hoje
            </button>
            <button
              type="button"
              className={glassTabLink(false)}
              onClick={() => {
                setSelection(null)
                void reloadWeek(shiftWeek(weekAnchor, 1))
              }}
            >
              Próxima semana →
            </button>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-cdl-muted">
              Equipe
              <select
                className={glassField(false)}
                value={teamFilter}
                onChange={(e) => {
                  const nextTeam = e.target.value
                  setTeamFilter(nextTeam)
                  if (rangeMode === 'custom') {
                    void reloadCustom(rangeFrom, rangeTo, nextTeam)
                  } else {
                    void reloadWeek(weekAnchor, nextTeam)
                  }
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
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-cdl-muted">
              Ano
              <select
                className={glassField(false)}
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-cdl-muted">
              Mês
              <select
                className={glassField(false)}
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
              >
                {AGENDA_MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={glassTabLink(false)}
              onClick={() => {
                setSelection(null)
                const from = toDayKey(startOfMonth(filterYear, filterMonth))
                const to = toDayKey(endOfMonth(filterYear, filterMonth))
                void reloadCustom(from, to)
              }}
            >
              Ver mês
            </button>
            <span className="pb-2 text-sm font-medium capitalize text-cdl-muted">
              {rangeMode === 'custom'
                ? formatRangeLabel(rangeFrom, rangeTo)
                : formatWeekRangeLabel(weekAnchor, todayKey)}
              {rangeMode === 'custom' ? ' · período' : ' · semana'}
              {loading ? ' · atualizando…' : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-cdl-border/60 pt-3">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-cdl-muted">
              De
              <input
                type="date"
                className={glassField(false)}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-cdl-muted">
              Até
              <input
                type="date"
                className={glassField(false)}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={glassTabLink(false)}
              onClick={() => {
                setSelection(null)
                void reloadCustom(rangeFrom, rangeTo)
              }}
            >
              Aplicar período
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {showPeriodList ? (
          <div className="liquid-glass-card space-y-3 p-4">
            <h2 className="text-base font-bold text-cdl-fg">
              Eventos no período ({periodEvents.length})
            </h2>
            <p className="text-xs text-cdl-muted">
              Lista do intervalo selecionado. O quadro abaixo continua semanal
              (semana do início do período).
            </p>
            {periodEvents.length === 0 ? (
              <p className="text-sm text-cdl-muted">
                Nenhum evento neste período.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-cdl-border">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-cdl-inset text-left text-[11px] uppercase tracking-wider text-cdl-muted">
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Horário</th>
                      <th className="px-3 py-2">Equipe</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Evento</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodEvents.map((ev) => (
                      <tr
                        key={ev.id}
                        className="border-t border-cdl-border text-cdl-fg"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {dayLabel(ev.event_date)}
                        </td>
                        <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                          {String(ev.start_time).slice(0, 5)}–
                          {String(ev.end_time).slice(0, 5)}
                        </td>
                        <td className="px-3 py-2">
                          {teamNameById.get(ev.team_id) ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {ev.quote_id ? (
                            <Link
                              href={`/quotes/${ev.quote_id}`}
                              className="underline-offset-2 hover:underline"
                            >
                              {ev.code}
                            </Link>
                          ) : (
                            ev.code
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {ev.title}
                          {ev.client_name ? (
                            <span className="text-cdl-muted">
                              {' '}
                              · {ev.client_name}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 capitalize">{ev.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-xs text-cdl-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-sky-300 bg-sky-100" />
            Agendado (dia fechado)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-dashed border-slate-300 bg-slate-100" />
            Concluído (dia fechado)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-emerald-200 bg-emerald-50" />
            Livre — pode agendar
          </span>
        </div>
        <p className="text-xs text-cdl-muted">
          Uma equipe só pode ter um evento por data. Se sábado estiver fechado,
          use domingo (se livre), dia útil ou feriado.
        </p>

        <div className="schedule-day-board max-h-[min(70vh,52rem)] overflow-auto rounded-2xl border border-cdl-border bg-cdl-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-[6.5rem] max-w-[6.5rem] border-b border-r border-cdl-border bg-cdl-surface px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-cdl-muted">
                  Equipe
                </th>
                {weekKeys.map((key) => {
                  const { weekday, date } = dayLabelParts(key)
                  const isToday = key === todayKey
                  const isPast = key < todayKey
                  return (
                    <th
                      key={key}
                      className={`sticky top-0 z-20 min-w-[5.5rem] border-b border-cdl-border px-1.5 py-2.5 text-center text-[11px] font-bold tracking-wider ${
                        isToday
                          ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
                          : isPast
                            ? 'bg-cdl-surface uppercase text-cdl-muted/70'
                            : 'bg-cdl-surface uppercase text-cdl-muted'
                      }`}
                    >
                      <span className="block capitalize">{weekday}</span>
                      <span
                        className={`block text-[0.65rem] font-normal ${
                          isToday
                            ? 'text-sky-700 dark:text-sky-300'
                            : 'text-cdl-muted'
                        }`}
                      >
                        {date}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((team) => (
                <tr key={team.id}>
                  <td className="sticky left-0 z-10 w-[6.5rem] max-w-[6.5rem] border-b border-r border-cdl-border bg-cdl-surface px-2 py-2 align-top">
                    <div className="flex items-start gap-1.5 text-center text-[11px] font-semibold leading-tight text-cdl-fg">
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: team.color }}
                      />
                      <span className="min-w-0 break-words">{team.name}</span>
                    </div>
                  </td>
                  {weekKeys.map((dayKey) => {
                    const cellSegs = segments
                      .filter((s) => s.teamId === team.id && s.dayKey === dayKey)
                      .sort((a, b) => a.startMin - b.startMin)
                    const selected =
                      selection?.teamId === team.id && selection.dayKey === dayKey
                    const isToday = dayKey === todayKey
                    const isPast = dayKey < todayKey
                    return (
                      <td
                        key={dayKey}
                        className={`border-b border-cdl-border p-1 align-top ${
                          selected
                            ? 'bg-sky-500/10 ring-2 ring-inset ring-sky-400/50'
                            : isToday
                              ? 'bg-sky-500/5'
                              : isPast
                                ? 'bg-cdl-inset/40'
                                : ''
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex min-h-[4.5rem] w-full cursor-pointer flex-col gap-1 rounded-lg p-1 text-left hover:bg-cdl-hover"
                          onClick={() => {
                            setSelection({ teamId: team.id, dayKey })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelection({ teamId: team.id, dayKey })
                            }
                          }}
                        >
                          {cellSegs.length === 0 ? (
                            <span className="rounded-md border border-emerald-200/60 bg-emerald-50/80 px-2 py-1 text-[0.7rem] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                              Livre o dia
                            </span>
                          ) : (
                            cellSegs.map((seg) =>
                              seg.quoteId ? (
                                <Link
                                  key={seg.eventId}
                                  href={`/quotes/${seg.quoteId}`}
                                  className={`block rounded-md border px-1.5 py-1 text-[0.68rem] leading-tight underline-offset-2 hover:underline ${
                                    seg.isHistorical
                                      ? 'border-dashed border-slate-300 bg-slate-100 text-slate-600'
                                      : 'border-sky-300 bg-sky-100 text-sky-900'
                                  }`}
                                  title={`${seg.title} — abrir cotação`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="block font-semibold tabular-nums">
                                    {formatMinutes(seg.startMin)}–
                                    {formatMinutes(seg.endMin)}
                                  </span>
                                  <span className="block truncate font-medium">
                                    {seg.code}
                                  </span>
                                </Link>
                              ) : (
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
                                    {formatMinutes(seg.startMin)}–
                                    {formatMinutes(seg.endMin)}
                                  </span>
                                  <span className="block truncate font-medium">
                                    {seg.code}
                                  </span>
                                </span>
                              ),
                            )
                          )}
                        </div>
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
                    className="flex flex-col gap-2 rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {seg.quoteId ? (
                        <Link
                          href={`/quotes/${seg.quoteId}`}
                          className="font-medium text-cdl-fg underline-offset-2 hover:underline"
                        >
                          <strong className="tabular-nums">
                            {formatMinutes(seg.startMin)}–{formatMinutes(seg.endMin)}
                          </strong>{' '}
                          · {seg.code} · {seg.title}
                          {seg.clientName ? (
                            <span className="text-cdl-muted"> · {seg.clientName}</span>
                          ) : null}
                        </Link>
                      ) : (
                        <>
                          <strong className="tabular-nums">
                            {formatMinutes(seg.startMin)}–{formatMinutes(seg.endMin)}
                          </strong>{' '}
                          · {seg.code} · {seg.title}
                          {seg.clientName ? (
                            <span className="text-cdl-muted"> · {seg.clientName}</span>
                          ) : null}
                        </>
                      )}
                      <p className="mt-0.5 text-xs text-cdl-muted">
                        {seg.quoteId
                          ? 'Clique para abrir a cotação (pacote, convidados, adicionais e total).'
                          : 'Sem cotação vinculada — use Nova cotação (fluxo completo).'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {seg.quoteId ? (
                        <Link
                          href={`/quotes/${seg.quoteId}`}
                          className={glassBtn('primary', 'liquid-glass-tab-link--plain')}
                        >
                          Ver cotação
                        </Link>
                      ) : (
                        <Link
                          href={buildAgendaQuoteHref({
                            eventDate: selection.dayKey,
                            startTime: formatMinutes(seg.startMin),
                            endTime: formatMinutes(seg.endMin),
                            eventName: seg.title,
                          })}
                          className={glassBtn('primary', 'liquid-glass-tab-link--plain')}
                        >
                          Criar cotação
                        </Link>
                      )}
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
                    </div>
                    {seg.status === 'scheduled' ? (
                      <TeamAvailabilitySharePanel
                        teamId={selectedTeam.id}
                        teamName={selectedTeam.name}
                        teamNotes={selectedTeam.notes}
                        eventCode={seg.code}
                        eventTitle={seg.title}
                        clientName={seg.clientName}
                        eventDate={selection.dayKey}
                        startTime={formatMinutes(seg.startMin)}
                        endTime={formatMinutes(seg.endMin)}
                        presentationTime={seg.presentationTime}
                        quoteId={seg.quoteId}
                        language={
                          selectedTeam.contact?.preferred_language ||
                          selectedTeam.preferred_language ||
                          'pt'
                        }
                        defaultPhone={selectedTeam.contact?.phone ?? null}
                        contactFullName={selectedTeam.contact?.full_name ?? null}
                        contactAbName={selectedTeam.contact?.ab_name ?? null}
                        confirmUrl={
                          seg.assignmentToken
                            ? buildPublicTeamAssignmentUrl(seg.assignmentToken)
                            : null
                        }
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {selectionDayBusy ? (
              <p className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                Dia fechado para esta equipe. Escolha outra data livre (domingo,
                dia útil ou feriado) ou outra equipe disponível.
              </p>
            ) : (
              <Link
                href={buildAgendaQuoteHref({
                  eventDate: selection.dayKey,
                  startTime: '10:00',
                  endTime: '14:00',
                })}
                className={glassBtn('primary')}
              >
                Nova cotação nesta data
              </Link>
            )}
          </div>
        ) : null}
    </div>
  )
}
