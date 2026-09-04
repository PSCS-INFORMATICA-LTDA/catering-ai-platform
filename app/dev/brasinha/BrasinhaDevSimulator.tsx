'use client'

import { useEffect, useState } from 'react'
import { tCommon } from '@/Lib/i18n/common'

const STORAGE_KEY = 'brasinha-dev-conversation-id'

type Trace = {
  tool: string
  source: string
  companyId: string
  denied?: boolean
  reason?: string
  ids?: Record<string, string | number | null>
}

type ChatRow = {
  role: 'customer' | 'assistant' | 'human' | 'system'
  content: string
  traces?: Trace[]
}

type ConversationPayload = {
  error?: string
  conversationId?: string
  companyId?: string
  language?: string
  handoffStatus?: string
  handoffReason?: string | null
  toolsCalled?: string[]
  traces?: Trace[]
  reply?: string
  reasonerKind?: string
  reasonerModel?: string | null
  providerFailure?: boolean
  providerErrorStatus?: string | null
  providerErrorCode?: string | null
  providerErrorType?: string | null
  intakeStage?: string | null
  missingFields?: string[]
  pendingActionType?: string | null
  readyForReview?: boolean
  readyToCreateQuote?: boolean
  packageKey?: string | null
  packageName?: string | null
  messages?: Array<{
    role?: ChatRow['role']
    content?: string
    traces?: Trace[]
  }>
}

function rowsFromMessages(messages: ConversationPayload['messages']): ChatRow[] {
  return (messages ?? [])
    .filter((row) => row.role === 'customer' || row.role === 'assistant')
    .map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : 'customer',
      content: row.content ?? '',
      traces: Array.isArray(row.traces) ? row.traces : [],
    }))
}

function sanitizedProviderError(traces: Trace[] | undefined) {
  const row = (traces ?? []).find((trace) => trace.reason === 'provider_failure')
  const status = row?.ids?.provider_error_status
  const code = row?.ids?.provider_error_code
  return {
    status: status == null ? null : String(status),
    code: code == null ? null : String(code),
  }
}

function intakeFromPayload(payload: ConversationPayload) {
  return {
    intakeStage: payload.intakeStage ?? null,
    missingFields: payload.missingFields ?? [],
    pendingActionType: payload.pendingActionType ?? null,
    readyForReview: Boolean(payload.readyForReview),
    readyToCreateQuote: Boolean(payload.readyToCreateQuote),
    packageKey: payload.packageKey ?? null,
    packageName: payload.packageName ?? null,
  }
}

function persistPointer(conversationId: string | null) {
  try {
    if (conversationId) {
      window.localStorage.setItem(STORAGE_KEY, conversationId)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (conversationId) url.searchParams.set('c', conversationId)
  else url.searchParams.delete('c')
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

export default function BrasinhaDevSimulator({
  companyId,
  companyDisplayName,
  personaName,
  personaRole,
  initialConversationId,
}: {
  companyId: string
  companyDisplayName?: string | null
  personaName: string
  personaRole: string
  initialConversationId?: string | null
}) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  )
  const [input, setInput] = useState('')
  const [rows, setRows] = useState<ChatRow[]>([])
  const [language, setLanguage] = useState('pt')
  const [handoff, setHandoff] = useState('AI_ACTIVE')
  const [handoffReason, setHandoffReason] = useState<string | null>(null)
  const [tools, setTools] = useState<string[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [reasonerKind, setReasonerKind] = useState<string>('deterministic')
  const [reasonerModel, setReasonerModel] = useState<string | null>(null)
  const [providerFailure, setProviderFailure] = useState(false)
  const [providerErrorStatus, setProviderErrorStatus] = useState<string | null>(null)
  const [providerErrorCode, setProviderErrorCode] = useState<string | null>(null)
  const [intakeStage, setIntakeStage] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [pendingActionType, setPendingActionType] = useState<string | null>(null)
  const [readyForReview, setReadyForReview] = useState(false)
  const [readyToCreateQuote, setReadyToCreateQuote] = useState(false)
  const [packageKey, setPackageKey] = useState<string | null>(null)
  const [packageName, setPackageName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const sendLabel = tCommon(language, 'send')

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      let pointer = initialConversationId?.trim() || ''
      if (!pointer) {
        try {
          pointer = window.localStorage.getItem(STORAGE_KEY)?.trim() || ''
        } catch {
          pointer = ''
        }
      }
      if (!pointer) {
        setReady(true)
        return
      }
      try {
        const response = await fetch(
          `/api/dev/brasinha/conversation?id=${encodeURIComponent(pointer)}`,
        )
        const payload = (await response.json()) as ConversationPayload
        if (cancelled) return
        if (!response.ok || !payload.conversationId) {
          persistPointer(null)
          setConversationId(null)
          setReady(true)
          return
        }
        setConversationId(payload.conversationId)
        setLanguage(payload.language ?? 'pt')
        setHandoff(payload.handoffStatus ?? 'AI_ACTIVE')
        setHandoffReason(payload.handoffReason ?? null)
        setRows(rowsFromMessages(payload.messages))
        const lastAssistant = [...(payload.messages ?? [])]
          .reverse()
          .find((row) => row.role === 'assistant')
        setTraces(lastAssistant?.traces ?? [])
        setTools((lastAssistant?.traces ?? []).map((trace) => trace.tool))
        const recovered = sanitizedProviderError(lastAssistant?.traces)
        setProviderFailure(Boolean(recovered.code))
        setProviderErrorStatus(recovered.status)
        setProviderErrorCode(recovered.code)
        const intake = intakeFromPayload(payload)
        setIntakeStage(intake.intakeStage)
        setMissingFields(intake.missingFields)
        setPendingActionType(intake.pendingActionType)
        setReadyForReview(intake.readyForReview)
        setReadyToCreateQuote(intake.readyToCreateQuote)
        setPackageKey(intake.packageKey)
        setPackageName(intake.packageName)
        persistPointer(payload.conversationId)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'hydrate_failed')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [initialConversationId])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    setRows((current) => [...current, { role: 'customer', content: text }])
    setInput('')
    try {
      const response = await fetch('/api/dev/brasinha/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, conversationId }),
      })
      const payload = (await response.json()) as ConversationPayload
      if (!response.ok) {
        setError(payload.error || `http_${response.status}`)
        return
      }
      const nextId = payload.conversationId ?? null
      setConversationId(nextId)
      persistPointer(nextId)
      setLanguage(payload.language ?? 'pt')
      setHandoff(payload.handoffStatus ?? 'AI_ACTIVE')
      setHandoffReason(payload.handoffReason ?? null)
      setTools(payload.toolsCalled ?? [])
      setTraces(payload.traces ?? [])
      setReasonerKind(payload.reasonerKind ?? 'deterministic')
      setReasonerModel(payload.reasonerModel ?? null)
      setProviderFailure(Boolean(payload.providerFailure))
      setProviderErrorStatus(payload.providerErrorStatus ?? null)
      setProviderErrorCode(payload.providerErrorCode ?? null)
      const intake = intakeFromPayload(payload)
      setIntakeStage(intake.intakeStage)
      setMissingFields(intake.missingFields)
      setPendingActionType(intake.pendingActionType)
      setReadyForReview(intake.readyForReview)
      setReadyToCreateQuote(intake.readyToCreateQuote)
      setPackageKey(intake.packageKey)
      setPackageName(intake.packageName)
      if (payload.messages?.length) {
        setRows(rowsFromMessages(payload.messages))
      } else if (payload.reply) {
        setRows((current) => [
          ...current,
          { role: 'assistant', content: payload.reply ?? '' },
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send_failed')
    } finally {
      setBusy(false)
    }
  }

  async function newConversation() {
    setBusy(true)
    try {
      await fetch('/api/dev/brasinha/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch {
      /* pointer reset is local; history stays in Supabase */
    }
    persistPointer(null)
    setConversationId(null)
    setRows([])
    setTools([])
    setTraces([])
    setHandoff('AI_ACTIVE')
    setHandoffReason(null)
    setReasonerKind('deterministic')
    setReasonerModel(null)
    setProviderFailure(false)
    setProviderErrorStatus(null)
    setProviderErrorCode(null)
    setIntakeStage(null)
    setMissingFields([])
    setPendingActionType(null)
    setReadyForReview(false)
    setReadyToCreateQuote(false)
    setPackageKey(null)
    setPackageName(null)
    setError(null)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-3xl flex-col gap-3">
      <header className="shrink-0">
        <p className="text-2xl font-semibold">🔥 {personaName}</p>
        <p className="text-sm font-medium">
          EMPRESA DO BRASINHA:{' '}
          {companyDisplayName || '—'}
        </p>
        <p className="text-sm text-cdl-muted">Assistente digital — DEV</p>
        <p className="mt-1 font-mono text-[10px] text-cdl-muted">{companyId}</p>
        <p className="sr-only">{personaRole}</p>
      </header>

      <details className="shrink-0 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
        <summary className="cursor-pointer font-medium">Diagnóstico DEV</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p>reasoner: {reasonerKind}</p>
          <p>model: {reasonerModel || '—'}</p>
          <p>language: {language}</p>
          <p>provider failure: {providerFailure ? 'yes' : 'no'}</p>
          <p>provider error status: {providerErrorStatus || '—'}</p>
          <p>provider error code: {providerErrorCode || '—'}</p>
          <p className="sm:col-span-2">
            conversation id:{' '}
            <span className="font-mono">{conversationId || '—'}</span>
          </p>
          <p>handoff: {handoff}</p>
          <p>handoff reason: {handoffReason || '—'}</p>
          <p>intake stage: {intakeStage || '—'}</p>
          <p>pending action: {pendingActionType || '—'}</p>
          <p>ready for review: {readyForReview ? 'yes' : 'no'}</p>
          <p>ready to create quote: {readyToCreateQuote ? 'yes' : 'no'}</p>
          <p className="sm:col-span-2">
            package: {packageName || '—'} {packageKey ? `(${packageKey})` : ''}
          </p>
          <p className="sm:col-span-2">
            missing: {missingFields.join(', ') || '—'}
          </p>
          <p className="sm:col-span-2">tools: {tools.join(', ') || '—'}</p>
          <ul className="sm:col-span-2 space-y-1">
            {traces.map((trace, index) => (
              <li key={`${trace.tool}-${index}`}>
                {trace.denied ? 'DENIED' : 'SOURCE'} {trace.tool} ← {trace.source}
                {trace.reason ? ` (${trace.reason})` : ''}
              </li>
            ))}
          </ul>
        </div>
      </details>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#111] p-4">
        {!ready ? (
          <p className="text-sm text-cdl-muted">Loading saved conversation…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-cdl-muted">
            Envie uma mensagem para conversar. O histórico salvo sobrevive ao reload.
          </p>
        ) : (
          rows.map((row, index) => (
            <div
              key={`${row.role}-${index}`}
              className={row.role === 'customer' ? 'ml-8 text-right' : 'mr-8 text-left'}
            >
              <p className="mb-1 text-[10px] uppercase text-cdl-muted">
                {row.role === 'assistant' ? personaName : 'Você'}
              </p>
              <p className="whitespace-pre-wrap rounded-2xl bg-white/5 px-3 py-2 text-sm">
                {row.content}
              </p>
            </div>
          ))
        )}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form
        className="sticky bottom-0 z-10 flex flex-col gap-2 bg-cdl-bg/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Mensagem"
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm sm:py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#991b1b] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:py-2"
        >
          {sendLabel}
        </button>
        <button
          type="button"
          onClick={() => void newConversation()}
          disabled={busy}
          className="rounded-lg border border-white/20 px-4 py-3 text-sm disabled:opacity-50 sm:py-2"
        >
          Nova conversa
        </button>
      </form>
    </div>
  )
}
