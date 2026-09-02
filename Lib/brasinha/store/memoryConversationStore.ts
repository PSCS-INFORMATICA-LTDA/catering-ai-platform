import { randomUUID } from 'node:crypto'
import type {
  BrasinhaChannelId,
  BrasinhaConversation,
  BrasinhaHandoffStatus,
  BrasinhaLanguage,
  BrasinhaStoredMessage,
} from '../types'

export type ConversationStore = {
  getOrCreate(input: {
    companyId: string
    conversationId?: string | null
    channel: BrasinhaChannelId
    language: BrasinhaLanguage
    externalContactRef?: string | null
  }): BrasinhaConversation
  get(companyId: string, conversationId: string): BrasinhaConversation | null
  listMessages(companyId: string, conversationId: string): BrasinhaStoredMessage[]
  appendMessage(
    companyId: string,
    message: Omit<BrasinhaStoredMessage, 'id' | 'createdAt'> & {
      id?: string
      createdAt?: string
    },
  ): BrasinhaStoredMessage
  setHandoff(
    companyId: string,
    conversationId: string,
    status: BrasinhaHandoffStatus,
    reason: string | null,
  ): BrasinhaConversation | null
  reset(companyId: string, conversationId: string): void
}

function nowIso() {
  return new Date().toISOString()
}

function scopedKey(companyId: string, conversationId: string) {
  return `${companyId}:${conversationId}`
}

export function createMemoryConversationStore(): ConversationStore {
  const conversations = new Map<string, BrasinhaConversation>()
  const messages = new Map<string, BrasinhaStoredMessage[]>()

  return {
    getOrCreate(input) {
      const id = input.conversationId?.trim() || randomUUID()
      const key = scopedKey(input.companyId, id)
      const existing = conversations.get(key)
      if (existing) return existing
      const created: BrasinhaConversation = {
        id,
        companyId: input.companyId,
        channel: input.channel,
        externalContactRef: input.externalContactRef ?? null,
        language: input.language,
        status: 'open',
        handoffStatus: 'AI_ACTIVE',
        handoffReason: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      conversations.set(key, created)
      messages.set(key, [])
      return created
    },
    get(companyId, conversationId) {
      return conversations.get(scopedKey(companyId, conversationId)) ?? null
    },
    listMessages(companyId, conversationId) {
      return [...(messages.get(scopedKey(companyId, conversationId)) ?? [])]
    },
    appendMessage(companyId, message) {
      const key = scopedKey(companyId, message.conversationId)
      if (message.companyId !== companyId) {
        throw new Error('company_scope_violation')
      }
      const stored: BrasinhaStoredMessage = {
        ...message,
        id: message.id ?? randomUUID(),
        createdAt: message.createdAt ?? nowIso(),
        companyId,
      }
      const list = messages.get(key) ?? []
      list.push(stored)
      messages.set(key, list)
      const conversation = conversations.get(key)
      if (conversation) conversation.updatedAt = stored.createdAt
      return stored
    },
    setHandoff(companyId, conversationId, status, reason) {
      const key = scopedKey(companyId, conversationId)
      const conversation = conversations.get(key)
      if (!conversation) return null
      conversation.handoffStatus = status
      conversation.handoffReason = reason
      conversation.updatedAt = nowIso()
      return conversation
    },
    reset(companyId, conversationId) {
      const key = scopedKey(companyId, conversationId)
      conversations.delete(key)
      messages.delete(key)
    },
  }
}

export const brasinhaMemoryStore = createMemoryConversationStore()
