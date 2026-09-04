import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { createEmptyQuoteDraft, parseQuoteDraft, type BrasinhaQuoteDraft } from '../intake/draft.ts'
import type {
  BrasinhaChannelId,
  BrasinhaConversation,
  BrasinhaHandoffStatus,
  BrasinhaLanguage,
  BrasinhaMessageDirection,
  BrasinhaMessageRole,
  BrasinhaStoredMessage,
  BrasinhaToolTrace,
} from '../types.ts'
import {
  COMPANY_SCOPE_VIOLATION,
  type ConversationStore,
} from './types.ts'

type ConversationRow = {
  id: string
  company_id: string
  channel: string
  external_contact_ref: string | null
  language: string
  status: string
  handoff_status: string
  handoff_reason: string | null
  created_at: string
  updated_at: string
}

type MessageRow = {
  id: string
  conversation_id: string
  company_id: string
  channel: string
  direction: string
  role: string
  language: string
  content: string
  traces: unknown
  created_at: string
}

function mapConversation(row: ConversationRow): BrasinhaConversation {
  return {
    id: row.id,
    companyId: row.company_id,
    channel: row.channel as BrasinhaChannelId,
    externalContactRef: row.external_contact_ref,
    language: row.language as BrasinhaLanguage,
    status: row.status === 'closed' ? 'closed' : 'open',
    handoffStatus: row.handoff_status as BrasinhaHandoffStatus,
    handoffReason: row.handoff_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessage(row: MessageRow): BrasinhaStoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    companyId: row.company_id,
    channel: row.channel as BrasinhaChannelId,
    direction: row.direction as BrasinhaMessageDirection,
    role: row.role as BrasinhaMessageRole,
    language: row.language as BrasinhaLanguage,
    content: row.content,
    traces: Array.isArray(row.traces) ? (row.traces as BrasinhaToolTrace[]) : [],
    createdAt: row.created_at,
  }
}

const INTAKE_DRAFT_MARKER = 'BRASINHA_INTAKE_DRAFT_V1:'

function draftFromSystemMessages(messages: BrasinhaStoredMessage[]): BrasinhaQuoteDraft {
  const latest = [...messages]
    .reverse()
    .find(
      (row) =>
        row.role === 'system' && row.content.startsWith(INTAKE_DRAFT_MARKER),
    )
  if (!latest) return createEmptyQuoteDraft()
  try {
    return parseQuoteDraft(JSON.parse(latest.content.slice(INTAKE_DRAFT_MARKER.length)))
  } catch {
    return createEmptyQuoteDraft()
  }
}

export function createSupabaseConversationStore(
  client: SupabaseClient,
): ConversationStore {
  return {
    async getOrCreate(input) {
      const requestedId = input.conversationId?.trim() || ''
      if (requestedId) {
        const { data: existing, error } = await client
          .from('brasinha_conversations')
          .select(
            'id, company_id, channel, external_contact_ref, language, status, handoff_status, handoff_reason, created_at, updated_at',
          )
          .eq('id', requestedId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (existing) {
          if (existing.company_id !== input.companyId) {
            throw new Error(COMPANY_SCOPE_VIOLATION)
          }
          return mapConversation(existing as ConversationRow)
        }
      }

      const now = new Date().toISOString()
      const insert = {
        id: requestedId || randomUUID(),
        company_id: input.companyId,
        channel: input.channel,
        external_contact_ref: input.externalContactRef ?? null,
        language: input.language,
        status: 'open',
        handoff_status: 'AI_ACTIVE',
        handoff_reason: null,
        created_at: now,
        updated_at: now,
      }
      const { data, error } = await client
        .from('brasinha_conversations')
        .insert(insert)
        .select(
          'id, company_id, channel, external_contact_ref, language, status, handoff_status, handoff_reason, created_at, updated_at',
        )
        .single()
      if (error) {
        if (error.code === '23505') throw new Error(COMPANY_SCOPE_VIOLATION)
        throw new Error(error.message)
      }
      return mapConversation(data as ConversationRow)
    },
    async get(companyId, conversationId) {
      const { data, error } = await client
        .from('brasinha_conversations')
        .select(
          'id, company_id, channel, external_contact_ref, language, status, handoff_status, handoff_reason, created_at, updated_at',
        )
        .eq('id', conversationId)
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? mapConversation(data as ConversationRow) : null
    },
    async listMessages(companyId, conversationId) {
      const { data, error } = await client
        .from('brasinha_messages')
        .select(
          'id, conversation_id, company_id, channel, direction, role, language, content, traces, created_at',
        )
        .eq('conversation_id', conversationId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []).map((row) => mapMessage(row as MessageRow))
    },
    async appendMessage(companyId, message) {
      if (message.companyId !== companyId) {
        throw new Error(COMPANY_SCOPE_VIOLATION)
      }
      const conversation = await this.get(companyId, message.conversationId)
      if (!conversation) {
        throw new Error(COMPANY_SCOPE_VIOLATION)
      }
      const createdAt = message.createdAt ?? new Date().toISOString()
      const insert = {
        id: message.id ?? randomUUID(),
        conversation_id: message.conversationId,
        company_id: companyId,
        channel: message.channel,
        direction: message.direction,
        role: message.role,
        language: message.language,
        content: message.content,
        traces: message.traces ?? [],
        created_at: createdAt,
      }
      const { data, error } = await client
        .from('brasinha_messages')
        .insert(insert)
        .select(
          'id, conversation_id, company_id, channel, direction, role, language, content, traces, created_at',
        )
        .single()
      if (error) throw new Error(error.message)
      await client
        .from('brasinha_conversations')
        .update({ updated_at: createdAt, language: message.language })
        .eq('id', message.conversationId)
        .eq('company_id', companyId)
      return mapMessage(data as MessageRow)
    },
    async getIntakeDraft(companyId, conversationId) {
      const conversation = await this.get(companyId, conversationId)
      if (!conversation) throw new Error(COMPANY_SCOPE_VIOLATION)
      const { data, error } = await client
        .from('brasinha_conversations')
        .select('intake_draft')
        .eq('id', conversationId)
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) {
        if (/intake_draft|schema cache|column/i.test(error.message)) {
          return draftFromSystemMessages(await this.listMessages(companyId, conversationId))
        }
        throw new Error(error.message)
      }
      const stored = (data as { intake_draft?: unknown } | null)?.intake_draft
      if (stored && typeof stored === 'object' && Object.keys(stored as object).length) {
        return parseQuoteDraft(stored)
      }
      return draftFromSystemMessages(await this.listMessages(companyId, conversationId))
    },
    async saveIntakeDraft(companyId, conversationId, draft) {
      const conversation = await this.get(companyId, conversationId)
      if (!conversation) throw new Error(COMPANY_SCOPE_VIOLATION)
      const next = parseQuoteDraft(draft)
      const { error } = await client
        .from('brasinha_conversations')
        .update({
          intake_draft: next,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('company_id', companyId)
      if (!error) return next
      if (!/intake_draft|schema cache|column/i.test(error.message)) {
        throw new Error(error.message)
      }
      await this.appendMessage(companyId, {
        conversationId,
        companyId,
        channel: conversation.channel,
        direction: 'outbound',
        role: 'system',
        language: conversation.language,
        content: `${INTAKE_DRAFT_MARKER}${JSON.stringify(next)}`,
        traces: [],
      })
      return next
    },
    async setHandoff(companyId, conversationId, status, reason) {
      const now = new Date().toISOString()
      const { data, error } = await client
        .from('brasinha_conversations')
        .update({
          handoff_status: status,
          handoff_reason: reason,
          updated_at: now,
        })
        .eq('id', conversationId)
        .eq('company_id', companyId)
        .select(
          'id, company_id, channel, external_contact_ref, language, status, handoff_status, handoff_reason, created_at, updated_at',
        )
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? mapConversation(data as ConversationRow) : null
    },
  }
}
