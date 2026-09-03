'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'brasinha-dev-conversation-id'

type Trace = {
  tool: string
  source: string
  companyId: string
  denied?: boolean
  reason?: string
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
  personaName,
  personaRole,
  initialConversationId,
}: {
  companyId: string
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

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
    setError(null)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <p className="text-xs uppercase tracking-wide text-cdl-muted">
          DEV simulator
        </p>
        <h1 className="text-2xl font-semibold">
          {personaName} 🔥
        </h1>
        <p className="text-sm text-cdl-muted">{personaRole}</p>
      </header>

      <section className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs sm:grid-cols-2">
        <p>company: <span className="font-mono">{companyId}</span></p>
        <p>language: {language}</p>
        <p className="sm:col-span-2">
          conversation id:{' '}
          <span className="font-mono">{conversationId || '—'}</span>
        </p>
        <p>handoff: {handoff}</p>
        <p>handoff reason: {handoffReason || '—'}</p>
        <p className="sm:col-span-2">tools: {tools.join(', ') || '—'}</p>
        <ul className="sm:col-span-2 space-y-1">
          {traces.map((trace, index) => (
            <li key={`${trace.tool}-${index}`}>
              {trace.denied ? 'DENIED' : 'SOURCE'} {trace.tool} ← {trace.source}
              {trace.reason ? ` (${trace.reason})` : ''}
            </li>
          ))}
        </ul>
      </section>

      <div className="min-h-72 space-y-3 rounded-xl border border-white/10 bg-[#111] p-4">
        {!ready ? (
          <p className="text-sm text-cdl-muted">Loading saved conversation…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-cdl-muted">
            Send a message to test the canonical brain. Saved conversations
            survive reload.
          </p>
        ) : (
          rows.map((row, index) => (
            <div
              key={`${row.role}-${index}`}
              className={row.role === 'customer' ? 'text-right' : 'text-left'}
            >
              <p className="mb-1 text-[10px] uppercase text-cdl-muted">{row.role}</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-white/5 px-3 py-2 text-sm">
                {row.content}
              </pre>
            </div>
          ))
        )}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Mensagem de teste"
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#991b1b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => void newConversation()}
          disabled={busy}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          Nova conversa
        </button>
      </form>
    </div>
  )
}
