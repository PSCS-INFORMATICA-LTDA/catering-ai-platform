import type { BrasinhaQuoteDraft } from '../intake/draft.ts'
import type {
  BrasinhaChannelId,
  BrasinhaConversation,
  BrasinhaHandoffStatus,
  BrasinhaLanguage,
  BrasinhaStoredMessage,
} from '../types.ts'

export type ConversationStore = {
  getOrCreate(input: {
    companyId: string
    conversationId?: string | null
    channel: BrasinhaChannelId
    language: BrasinhaLanguage
    externalContactRef?: string | null
  }): Promise<BrasinhaConversation>
  get(companyId: string, conversationId: string): Promise<BrasinhaConversation | null>
  listMessages(
    companyId: string,
    conversationId: string,
  ): Promise<BrasinhaStoredMessage[]>
  appendMessage(
    companyId: string,
    message: Omit<BrasinhaStoredMessage, 'id' | 'createdAt'> & {
      id?: string
      createdAt?: string
    },
  ): Promise<BrasinhaStoredMessage>
  setHandoff(
    companyId: string,
    conversationId: string,
    status: BrasinhaHandoffStatus,
    reason: string | null,
  ): Promise<BrasinhaConversation | null>
  getIntakeDraft(companyId: string, conversationId: string): Promise<BrasinhaQuoteDraft>
  saveIntakeDraft(
    companyId: string,
    conversationId: string,
    draft: BrasinhaQuoteDraft,
  ): Promise<BrasinhaQuoteDraft>
}

export const COMPANY_SCOPE_VIOLATION = 'company_scope_violation'
