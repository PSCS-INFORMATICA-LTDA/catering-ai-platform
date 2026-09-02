'use client'

import { useState } from 'react'

type Trace = {
  tool: string
  source: string
  companyId: string
  denied?: boolean
  reason?: string
}

type ChatRow = {
  role: 'customer' | 'assistant'
  content: string
}

export default function BrasinhaDevSimulator({
  companyId,
  personaName,
  personaRole,
}: {
  companyId: string
  personaName: string
  personaRole: string
}) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [rows, setRows] = useState<ChatRow[]>([])
  const [language, setLanguage] = useState('pt')
  const [handoff, setHandoff] = useState('AI_ACTIVE')
  const [tools, setTools] = useState<string[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const payload = (await response.json()) as {
        error?: string
        conversationId?: string
        language?: string
        handoffStatus?: string
        toolsCalled?: string[]
        traces?: Trace[]
        reply?: string
      }
      if (!response.ok) {
        setError(payload.error || `http_${response.status}`)
        return
      }
      setConversationId(payload.conversationId ?? null)
      setLanguage(payload.language ?? 'pt')
      setHandoff(payload.handoffStatus ?? 'AI_ACTIVE')
      setTools(payload.toolsCalled ?? [])
      setTraces(payload.traces ?? [])
      if (payload.reply) {
        setRows((current) => [...current, { role: 'assistant', content: payload.reply ?? '' }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send_failed')
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    try {
      await fetch('/api/dev/brasinha/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })
    } catch {
      /* bench reset is best-effort */
    }
    setConversationId(null)
    setRows([])
    setTools([])
    setTraces([])
    setHandoff('AI_ACTIVE')
    setError(null)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <p className="text-xs uppercase tracking-wide text-cdl-muted">DEV simulator</p>
        <h1 className="text-2xl font-semibold">{personaName}</h1>
        <p className="text-sm text-cdl-muted">{personaRole}</p>
        <p className="mt-1 font-mono text-xs text-cdl-muted">company {companyId}</p>
      </header>

      <section className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs sm:grid-cols-2">
        <p>language: {language}</p>
        <p>handoff: {handoff}</p>
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
        {rows.length === 0 ? (
          <p className="text-sm text-cdl-muted">Send a message to test the canonical brain.</p>
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
          onClick={() => void reset()}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm"
        >
          Reset
        </button>
      </form>
    </div>
  )
}
