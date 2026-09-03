export type BrasinhaLanguage = 'pt' | 'en' | 'es'
export type BrasinhaChannelId = 'dev_simulator' | 'whatsapp' | 'web' | 'voice'
export type BrasinhaMessageDirection = 'inbound' | 'outbound'
export type BrasinhaMessageRole = 'customer' | 'assistant' | 'human' | 'system'
export type BrasinhaHandoffStatus =
  | 'AI_ACTIVE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'HUMAN_ACTIVE'
  | 'CLOSED'

export type InboundMessage = {
  channel: BrasinhaChannelId
  companyId: string
  conversationId?: string | null
  externalContactRef?: string | null
  languageHint?: BrasinhaLanguage | null
  text: string
  receivedAt?: string
}

export type OutboundMessage = {
  channel: BrasinhaChannelId
  companyId: string
  conversationId: string
  language: BrasinhaLanguage
  text: string
  handoffStatus: BrasinhaHandoffStatus
  createdAt: string
}

export type BrasinhaToolTrace = {
  tool: string
  source: string
  companyId: string
  ids: Record<string, string | number | null>
  timestamp: string
  denied?: boolean
  reason?: string
}

export type BrasinhaConversation = {
  id: string
  companyId: string
  channel: BrasinhaChannelId
  externalContactRef: string | null
  language: BrasinhaLanguage
  status: 'open' | 'closed'
  handoffStatus: BrasinhaHandoffStatus
  handoffReason: string | null
  createdAt: string
  updatedAt: string
}

export type BrasinhaStoredMessage = {
  id: string
  conversationId: string
  companyId: string
  channel: BrasinhaChannelId
  direction: BrasinhaMessageDirection
  role: BrasinhaMessageRole
  language: BrasinhaLanguage
  content: string
  traces: BrasinhaToolTrace[]
  createdAt: string
}

export type BrasinhaReasonerKind = 'deterministic' | 'openai'

export type BrasinhaTurnResult = {
  conversation: BrasinhaConversation
  reply: OutboundMessage
  traces: BrasinhaToolTrace[]
  detectedLanguage: BrasinhaLanguage
  toolsCalled: string[]
  reasonerKind: BrasinhaReasonerKind
  reasonerModel: string | null
  providerFailure: boolean
  providerErrorStatus: string | null
  providerErrorCode: string | null
  providerErrorType: string | null
}
