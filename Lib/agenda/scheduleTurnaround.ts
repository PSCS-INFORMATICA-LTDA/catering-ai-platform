/**
 * Janela operacional entre eventos (turnaround).
 *
 * Config por empresa em commercial_rules.rule_key = schedule_turnaround_buffer
 * (mesmo padrão JSON de supplier_garnish_kit_packing — store genérico por company_id).
 *
 * NÃO herda CDL silenciosamente: sem regra ativa → min_gap_minutes = 0
 * (apenas overlap real do evento). CDL recebe 120 via seed DEV.
 *
 * Distância 20 mi: sem lat/lng confiável nesta fase — se distance_miles for
 * informado e > base_radius → DISTANCE_REQUIRES_REVIEW (sem inventar gap extra).
 */

export const SCHEDULE_TURNAROUND_RULE_KEY = 'schedule_turnaround_buffer'

export type ScheduleTurnaroundConfig = {
  enabled: boolean
  base_radius_miles: number
  min_gap_minutes: number
  outside_radius_policy: 'manual_review'
}

/** Preset piloto CDL — só persistir via seed/regra da empresa. */
export const CDL_SCHEDULE_TURNAROUND_CONFIG: ScheduleTurnaroundConfig = {
  enabled: true,
  base_radius_miles: 20,
  min_gap_minutes: 120,
  outside_radius_policy: 'manual_review',
}

/**
 * Fallback seguro sem regra: não copia 120 da CDL.
 * Só bloqueia sobreposição real do intervalo do evento.
 */
export const DEFAULT_SCHEDULE_TURNAROUND_CONFIG: ScheduleTurnaroundConfig = {
  enabled: true,
  base_radius_miles: 20,
  min_gap_minutes: 0,
  outside_radius_policy: 'manual_review',
}

export type ScheduleConflictCode =
  | 'EVENT_TIME_OVERLAP'
  | 'TEAM_TURNAROUND_CONFLICT'
  | 'PERSON_TURNAROUND_CONFLICT'
  | 'DISTANCE_REQUIRES_REVIEW'

export type ScheduleEventInstant = {
  id?: string
  event_date: string
  start_time: string
  end_time: string
  status?: string
  /** Milhas da base → evento, quando conhecido. Sem dado = null. */
  distance_miles?: number | null
}

export type ScheduleConflictResult = {
  code: ScheduleConflictCode
  conflictingEventId?: string
  blockedUntil: string | null
  nextAvailableStart: string | null
  minGapMinutes: number
  messagePt: string
  messageEn: string
  messageEs: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Parse date YYYY-MM-DD + time HH:MM[:SS] → Date local (minutos). */
export function combineEventDateTime(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const parts = time.trim().slice(0, 8).split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const s = parts[2] ?? 0
  return new Date(y, (mo ?? 1) - 1, d ?? 1, h, m, s, 0)
}

export function formatTimeHHMM(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatDateYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** blocked_until = event.end_at + min_gap_minutes */
export function getOperationalBlockedUntil(
  eventEndAt: Date,
  minGapMinutes: number,
): Date {
  const gap = Math.max(0, Math.floor(minGapMinutes))
  return new Date(eventEndAt.getTime() + gap * 60_000)
}

export function parseScheduleTurnaroundConfig(
  raw: unknown,
): ScheduleTurnaroundConfig | null {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  if (obj.enabled === false) {
    return { ...DEFAULT_SCHEDULE_TURNAROUND_CONFIG, enabled: false }
  }
  return {
    enabled: obj.enabled !== false,
    base_radius_miles: Number(
      obj.base_radius_miles ?? DEFAULT_SCHEDULE_TURNAROUND_CONFIG.base_radius_miles,
    ),
    min_gap_minutes: Number(
      obj.min_gap_minutes ?? DEFAULT_SCHEDULE_TURNAROUND_CONFIG.min_gap_minutes,
    ),
    outside_radius_policy: 'manual_review',
  }
}

/** Extrai config de rule_value commercial_rules (value string JSON ou objeto). */
export function configFromCommercialRuleValue(
  ruleValue: unknown,
): ScheduleTurnaroundConfig {
  if (!ruleValue || typeof ruleValue !== 'object') {
    return DEFAULT_SCHEDULE_TURNAROUND_CONFIG
  }
  const rv = ruleValue as Record<string, unknown>
  if (rv.type === 'json' || rv.value != null) {
    const parsed = parseScheduleTurnaroundConfig(rv.value)
    if (parsed) return parsed
  }
  const parsed = parseScheduleTurnaroundConfig(ruleValue)
  return parsed ?? DEFAULT_SCHEDULE_TURNAROUND_CONFIG
}

export function buildScheduleTurnaroundRuleValue(
  config: ScheduleTurnaroundConfig = CDL_SCHEDULE_TURNAROUND_CONFIG,
) {
  return {
    value: JSON.stringify(config),
    type: 'json',
    label_pt: 'Janela operacional entre eventos (minutos / raio mi)',
  }
}

function intervalsOverlapAbs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

function buildMessages(params: {
  code: ScheduleConflictCode
  blockedUntil: Date | null
  scope: 'team' | 'person'
  personName?: string | null
}): Pick<ScheduleConflictResult, 'messagePt' | 'messageEn' | 'messageEs'> {
  const until = params.blockedUntil
    ? formatTimeHHMM(params.blockedUntil)
    : null

  if (params.code === 'DISTANCE_REQUIRES_REVIEW') {
    return {
      messagePt: 'Requer análise operacional (fora do raio de 20 milhas).',
      messageEn: 'Requires operational review (outside 20-mile radius).',
      messageEs: 'Requiere revisión operativa (fuera del radio de 20 millas).',
    }
  }

  if (params.code === 'EVENT_TIME_OVERLAP') {
    return {
      messagePt: until
        ? `Horário sobreposto ao evento existente. Indisponível até ${until}.`
        : 'Horário sobreposto ao evento existente.',
      messageEn: until
        ? `Overlaps an existing event. Unavailable until ${until}.`
        : 'Overlaps an existing event.',
      messageEs: until
        ? `Se solapa con un evento existente. No disponible hasta ${until}.`
        : 'Se solapa con un evento existente.',
    }
  }

  const who =
    params.scope === 'person'
      ? params.personName?.trim() || 'Integrante'
      : 'Equipe'

  return {
    messagePt: until
      ? `${who} indisponível até ${until}. Janela operacional entre eventos.`
      : `${who} com janela operacional insuficiente entre eventos.`,
    messageEn: until
      ? `${who} unavailable until ${until}. Operational turnaround between events.`
      : `${who} has insufficient operational turnaround between events.`,
    messageEs: until
      ? `${who} no disponible hasta ${until}. Ventana operativa entre eventos.`
      : `${who} con ventana operativa insuficiente entre eventos.`,
  }
}

/**
 * Motor central: overlap real + janela operacional + raio (quando informado).
 */
export function canScheduleNextEvent(
  previousEvent: ScheduleEventInstant,
  nextEvent: ScheduleEventInstant,
  config: ScheduleTurnaroundConfig = DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
  options?: {
    scope?: 'team' | 'person'
    personName?: string | null
  },
): ScheduleConflictResult | null {
  const scope = options?.scope ?? 'team'
  const cfg = config.enabled === false
    ? { ...DEFAULT_SCHEDULE_TURNAROUND_CONFIG, min_gap_minutes: 0 }
    : config

  const prevStart = combineEventDateTime(
    previousEvent.event_date,
    previousEvent.start_time,
  )
  const prevEnd = combineEventDateTime(
    previousEvent.event_date,
    previousEvent.end_time,
  )
  const nextStart = combineEventDateTime(
    nextEvent.event_date,
    nextEvent.start_time,
  )
  const nextEnd = combineEventDateTime(nextEvent.event_date, nextEvent.end_time)

  if (!(prevEnd > prevStart) || !(nextEnd > nextStart)) {
    return null
  }

  // Distância: só se dado confiável foi passado (não geocode nesta fase)
  const dist =
    nextEvent.distance_miles ?? previousEvent.distance_miles ?? null
  if (
    dist != null &&
    Number.isFinite(dist) &&
    dist > cfg.base_radius_miles &&
    cfg.outside_radius_policy === 'manual_review'
  ) {
    const msgs = buildMessages({
      code: 'DISTANCE_REQUIRES_REVIEW',
      blockedUntil: null,
      scope,
    })
    return {
      code: 'DISTANCE_REQUIRES_REVIEW',
      conflictingEventId: previousEvent.id,
      blockedUntil: null,
      nextAvailableStart: null,
      minGapMinutes: cfg.min_gap_minutes,
      ...msgs,
    }
  }

  const blockedUntil = getOperationalBlockedUntil(prevEnd, cfg.min_gap_minutes)

  // 1) Overlap real do evento
  if (intervalsOverlapAbs(prevStart, prevEnd, nextStart, nextEnd)) {
    const code: ScheduleConflictCode = 'EVENT_TIME_OVERLAP'
    const msgs = buildMessages({
      code,
      blockedUntil,
      scope,
      personName: options?.personName,
    })
    return {
      code,
      conflictingEventId: previousEvent.id,
      blockedUntil: formatTimeHHMM(blockedUntil),
      nextAvailableStart: formatTimeHHMM(blockedUntil),
      minGapMinutes: cfg.min_gap_minutes,
      ...msgs,
    }
  }

  // 2) Janela operacional: next.start < previous.end + gap
  // Também o simétrico (next termina e previous começa na janela)
  const nextBlockedUntil = getOperationalBlockedUntil(
    nextEnd,
    cfg.min_gap_minutes,
  )
  const nextStartsTooSoon = nextStart.getTime() < blockedUntil.getTime()
  const prevStartsTooSoon = prevStart.getTime() < nextBlockedUntil.getTime()

  // Se não há overlap e next começa depois do blocked_until do previous → ok
  // Mas se previous começa depois do next (ordem invertida), aplicar simetria
  if (nextStart >= prevEnd) {
    if (nextStartsTooSoon && cfg.min_gap_minutes > 0) {
      const code: ScheduleConflictCode =
        scope === 'person'
          ? 'PERSON_TURNAROUND_CONFLICT'
          : 'TEAM_TURNAROUND_CONFLICT'
      const msgs = buildMessages({
        code,
        blockedUntil,
        scope,
        personName: options?.personName,
      })
      return {
        code,
        conflictingEventId: previousEvent.id,
        blockedUntil: formatTimeHHMM(blockedUntil),
        nextAvailableStart: formatTimeHHMM(blockedUntil),
        minGapMinutes: cfg.min_gap_minutes,
        ...msgs,
      }
    }
    return null
  }

  if (prevStart >= nextEnd) {
    if (prevStartsTooSoon && cfg.min_gap_minutes > 0) {
      const code: ScheduleConflictCode =
        scope === 'person'
          ? 'PERSON_TURNAROUND_CONFLICT'
          : 'TEAM_TURNAROUND_CONFLICT'
      const msgs = buildMessages({
        code,
        blockedUntil: nextBlockedUntil,
        scope,
        personName: options?.personName,
      })
      return {
        code,
        conflictingEventId: previousEvent.id,
        blockedUntil: formatTimeHHMM(nextBlockedUntil),
        nextAvailableStart: formatTimeHHMM(nextBlockedUntil),
        minGapMinutes: cfg.min_gap_minutes,
        ...msgs,
      }
    }
    return null
  }

  return null
}

/** Próximo horário disponível após um evento (end + gap). */
export function getNextAvailableStartAfterEvent(
  event: ScheduleEventInstant,
  config: ScheduleTurnaroundConfig,
): { at: Date; time: string; date: string } {
  const endAt = combineEventDateTime(event.event_date, event.end_time)
  const at = getOperationalBlockedUntil(endAt, config.min_gap_minutes)
  return {
    at,
    time: formatTimeHHMM(at),
    date: formatDateYYYYMMDD(at),
  }
}
