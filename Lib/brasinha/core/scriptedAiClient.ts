import { detectBrasinhaLanguage } from '../language.ts'
import type { BrasinhaLanguage } from '../types.ts'
import type {
  BrasinhaAiClient,
  BrasinhaAiCompleteInput,
  BrasinhaAiCompleteResult,
  BrasinhaAiToolCall,
} from './aiClient.ts'
import { handoffReply } from '../policy.ts'
import {
  catalogReply,
  extraHourHandoffReply,
  packageDetailsReply,
  packagesReply,
  quoteStatusReply,
  serviceTimingReply,
  socialReply,
} from './copy.ts'
import { detectSocialTurn, extractCustomerName } from './social.ts'

export function createScriptedAiClient(
  handler: (
    input: BrasinhaAiCompleteInput,
  ) => Promise<BrasinhaAiCompleteResult> | BrasinhaAiCompleteResult,
): BrasinhaAiClient {
  return {
    async complete(input) {
      const result = await handler(input)
      return {
        responseId: result.responseId || 'scripted',
        text: result.text ?? null,
        toolCalls: result.toolCalls ?? [],
      }
    },
  }
}

function lastUserText(input: BrasinhaAiCompleteInput): string {
  return [...input.messages].reverse().find((row) => row.role === 'user')?.content ?? ''
}

function historyText(input: BrasinhaAiCompleteInput): string {
  return input.messages.map((row) => row.content).join('\n')
}

function call(
  name: string,
  args: Record<string, unknown>,
  id: string,
): BrasinhaAiToolCall {
  return { callId: id, name, arguments: args }
}

function inferPackageQuery(text: string, history: string): string | null {
  const hay = `${text}\n${history}`
  if (/\bchoice\b/i.test(text)) return 'Choice'
  if (/\bprime\b/i.test(text)) return 'Prime'
  if (/\b(traditional|tradicional)\b/i.test(text)) return 'Traditional'
  if (/\bselect\b/i.test(text)) return 'Select'
  if (/\b(luxury|luxo)\b/i.test(text)) return 'Luxury'
  if (/^(e o|and (the )?|y el)\b/i.test(text.trim()) && /\bprime\b/i.test(hay)) {
    return 'Prime'
  }
  return null
}

function packagesFromContext(text: string, history: string): string[] {
  const hay = `${history}\n${text}`
  return ['Choice', 'Prime', 'Traditional', 'Select', 'Luxury'].filter((name) =>
    new RegExp(`\\b${name}\\b`, 'i').test(hay),
  )
}

function parseToolPayload(output: string): { tool?: string; data?: unknown } {
  try {
    return JSON.parse(output.replace(/…$/, '')) as { tool?: string; data?: unknown }
  } catch {
    return {}
  }
}

function formatFromTools(
  input: BrasinhaAiCompleteInput,
  language: BrasinhaLanguage,
): string {
  const payloads = (input.toolResults ?? []).map((row) => parseToolPayload(row.output))
  const packages = payloads.flatMap((row) => {
    if (row.tool === 'get_package_details' && row.data) return [row.data]
    if (row.tool === 'get_packages' && Array.isArray(row.data)) return row.data
    return []
  }) as Array<{
    label: string
    pricePerPerson: number | null
    currency: string
    description: string | null
    custom: boolean
    id: string
    packageKey: string | null
  }>
  const rules = payloads.find((row) => row.tool === 'get_public_business_rules')?.data as
    | {
        serviceDurationHours: number
        crewSetupLeadMinutes: number
      }
    | undefined
  const catalog = payloads.flatMap((row) => {
    if (row.tool === 'get_catalog_item' && row.data) return [row.data]
    if (row.tool === 'search_catalog' && Array.isArray(row.data)) return row.data
    return []
  }) as Array<{
    id: string
    itemKey: string | null
    label: string
    price: number | null
    currency: string
    category: string | null
  }>
  const quote = payloads.find((row) => row.tool === 'get_quote_by_public_reference')?.data as
    | { quoteNumber: string; status: string | null; total: number | null }
    | null
    | undefined

  if (rules) return serviceTimingReply(language, rules)
  if (quote !== undefined) return quoteStatusReply(language, quote ?? null)
  if (packages.length > 1) {
    return packages
      .map((pkg) => packageDetailsReply(language, pkg))
      .filter(Boolean)
      .join('\n\n')
  }
  if (packages.length === 1) {
    return packageDetailsReply(language, packages[0]!) ?? extraHourHandoffReply(language)
  }
  if (payloads.some((row) => row.tool === 'get_packages')) {
    return packagesReply(language, packages)
  }
  if (catalog.length) return catalogReply(language, catalog)
  const intake = payloads.find(
    (row) =>
      row.tool === 'apply_quote_intake_patch' ||
      row.tool === 'resolve_pending_intake_action',
  )
  if (intake) {
    return language === 'en'
      ? 'Got it. We can continue with the next quote detail.'
      : 'Perfeito. Podemos seguir com o próximo detalhe da cotação.'
  }
  return handoffReply(language)
}

export function createConversationalScriptedClient(): BrasinhaAiClient {
  return createScriptedAiClient((input) => {
    const text = lastUserText(input)
    const language = detectBrasinhaLanguage(text)
    if (input.toolResults?.length) {
      return { responseId: 'scripted-tools', text: formatFromTools(input, language), toolCalls: [] }
    }

    const social = detectSocialTurn(text)
    if (social) {
      return {
        responseId: 'scripted-social',
        text: socialReply(language, social, extractCustomerName(text), text),
        toolCalls: [],
      }
    }

    if (/hora extra|mais uma hora|extra hour|hora adicional/i.test(text)) {
      return {
        responseId: 'scripted-extra',
        text: extraHourHandoffReply(language),
        toolCalls: [],
      }
    }

    if (/diferen|compar|difference|dos dois/i.test(text)) {
      const names = packagesFromContext(text, historyText(input))
      const queries = names.length ? names : ['Choice', 'Prime']
      return {
        responseId: 'scripted-compare',
        text: null,
        toolCalls: queries.map((query, index) =>
          call('get_package_details', { query, language }, `cmp_${index}`),
        ),
      }
    }

    if (
      /\b(tempo|ficam|dura|how long|crew|equipe chega|cu[aá]nto dura)\b/i.test(text) &&
      !/hora extra|mais uma hora|extra hour/i.test(text)
    ) {
      return {
        responseId: 'scripted-rules',
        text: null,
        toolCalls: [call('get_public_business_rules', { language }, 'rules_1')],
      }
    }

    const pkg = inferPackageQuery(text, historyText(input))
    if (pkg) {
      return {
        responseId: 'scripted-package',
        text: null,
        toolCalls: [call('get_package_details', { query: pkg, language }, 'pkg_1')],
      }
    }

    return {
      responseId: 'scripted-fallback',
      text: socialReply(language, 'ack'),
      toolCalls: [],
    }
  })
}
