'use client'

import { useState } from 'react'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { tCommon } from '@/Lib/i18n/common'
import { ReviewCard } from './ReviewCard'

export function InternalNotesCard({
  quoteId,
  locale,
  initialNotes,
  canManage,
}: {
  quoteId: string
  locale: string
  initialNotes: string
  canManage: boolean
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/quotes/${quoteId}/internal-notes`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        data?: { notes?: string }
      }
      if (!response.ok) {
        throw new Error(result.error || tCommercialReview(locale, 'notesSaveError'))
      }
      setNotes(result.data?.notes ?? notes)
      setMessage(tCommercialReview(locale, 'notesSaved'))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : tCommercialReview(locale, 'notesSaveError'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ReviewCard title={tCommercialReview(locale, 'notes')} testId="commercial-review-notes">
      <p className="text-xs font-semibold text-amber-800">
        {tCommercialReview(locale, 'notesHint')}
      </p>
      <textarea
        data-testid="commercial-review-notes-input"
        className="mt-3 min-h-28 w-full rounded-2xl border border-cdl-border bg-white px-3 py-2 text-sm text-cdl-fg"
        value={notes}
        disabled={!canManage || saving}
        placeholder={tCommercialReview(locale, 'notesPlaceholder')}
        onChange={(event) => setNotes(event.target.value)}
      />
      {canManage ? (
        <button
          type="button"
          data-testid="commercial-review-notes-save"
          disabled={saving}
          onClick={() => void save()}
          className="mt-3 min-h-11 rounded-xl bg-neutral-900 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? tCommon(locale, 'saving') : tCommon(locale, 'save')}
        </button>
      ) : null}
      {message ? <p className="mt-2 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </ReviewCard>
  )
}
