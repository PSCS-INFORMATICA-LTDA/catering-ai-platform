import { randomUUID } from 'node:crypto'
import type {
  BrasinhaConversation,
  BrasinhaStoredMessage,
} from '../types.ts'
import {
  COMPANY_SCOPE_VIOLATION,
  type ConversationStore,
} from './types.ts'

export type { ConversationStore } from './types.ts'

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
    async getOrCreate(input) {
      const id = input.conversationId?.trim() || randomUUID()
      const key = scopedKey(input.companyId, id)
      const existing = conversations.get(key)
      if (existing) return existing
      for (const conversation of conversations.values()) {
        if (conversation.id === id && conversation.companyId !== input.companyId) {
          throw new Error(COMPANY_SCOPE_VIOLATION)
        }
      }
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
    async get(companyId, conversationId) {
      return conversations.get(scopedKey(companyId, conversationId)) ?? null
    },
    async listMessages(companyId, conversationId) {
      return [...(messages.get(scopedKey(companyId, conversationId)) ?? [])]
    },
    async appendMessage(companyId, message) {
      const key = scopedKey(companyId, message.conversationId)
      if (message.companyId !== companyId) {
        throw new Error(COMPANY_SCOPE_VIOLATION)
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
    async setHandoff(companyId, conversationId, status, reason) {
      const key = scopedKey(companyId, conversationId)
      const conversation = conversations.get(key)
      if (!conversation) return null
      conversation.handoffStatus = status
      conversation.handoffReason = reason
      conversation.updatedAt = nowIso()
      return conversation
    },
  }
}

export const brasinhaMemoryStore = createMemoryConversationStore()
