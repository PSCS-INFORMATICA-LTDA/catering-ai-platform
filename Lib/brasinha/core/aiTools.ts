import {
  applyQuoteIntakePatch,
  rememberOfferedPackages,
  resolvePendingIntakeAction,
  type IntakePatch,
} from '../intake/apply.ts'
import { snapshotQuoteDraft, type BrasinhaQuoteDraft } from '../intake/draft.ts'
import { BLOCKED_WRITE_TOOLS, type BrasinhaCatalogPort } from '../tools/types.ts'
import type { BrasinhaLanguage, BrasinhaToolTrace } from '../types.ts'

export const ALLOWED_AI_TOOLS = [
  'get_company_public_profile',
  'get_packages',
  'get_package_details',
  'get_catalog_item',
  'search_catalog',
  'get_public_business_rules',
  'get_quote_by_public_reference',
  'get_package_configuration',
  'get_available_additionals_for_package',
  'get_public_service_options',
  'apply_quote_intake_patch',
  'resolve_pending_intake_action',
] as const

export type AllowedAiTool = (typeof ALLOWED_AI_TOOLS)[number]

export type BrasinhaAiToolDefinition = {
  name: AllowedAiTool
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
    additionalProperties: false
  }
}

const languageProperty = {
  type: 'string',
  enum: ['pt', 'en', 'es'],
  description: 'Idioma da resposta canônica.',
}

export const BRASINHA_AI_TOOL_DEFINITIONS: BrasinhaAiToolDefinition[] = [
  {
    name: 'get_company_public_profile',
    description: 'Perfil público canônico da empresa da sessão autorizada.',
    parameters: {
      type: 'object',
      properties: { language: languageProperty },
      required: ['language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_packages',
    description: 'Lista pacotes ativos da empresa da sessão. Não invente preços.',
    parameters: {
      type: 'object',
      properties: { language: languageProperty },
      required: ['language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_package_details',
    description: 'Detalhe e preço canônico de um pacote (ex.: Choice, Prime).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome ou chave do pacote.' },
        language: languageProperty,
      },
      required: ['query', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_catalog_item',
    description: 'Um item/adicional canônico do catálogo da empresa da sessão.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome ou chave do item.' },
        language: languageProperty,
      },
      required: ['query', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_catalog',
    description: 'Busca curta no catálogo da empresa da sessão. Não peça o catálogo inteiro.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca.' },
        language: languageProperty,
      },
      required: ['query', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_public_business_rules',
    description:
      'Regras públicas ativas (duração de serviço, chegada da equipe, mínimos). Não peça hora extra.',
    parameters: {
      type: 'object',
      properties: { language: languageProperty },
      required: ['language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_quote_by_public_reference',
    description: 'Status público de uma cotação pelo número (ex.: Q-2026-1).',
    parameters: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'Número público da cotação.' },
        language: languageProperty,
      },
      required: ['reference', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_package_configuration',
    description:
      'Composição canônica do pacote: itens incluídos e option groups obrigatórios. Não invente escolhas.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome, chave ou id do pacote.' },
        language: languageProperty,
      },
      required: ['query', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_available_additionals_for_package',
    description:
      'Adicionais disponíveis, incluídos e já selecionados no pacote. Nunca cobre item INCLUDED_IN_PACKAGE ou SELECTED_IN_PACKAGE.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome, chave ou id do pacote atual.' },
        language: languageProperty,
      },
      required: ['query', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_public_service_options',
    description:
      'Opções canônicas de garçom, kit descartável e aluguel de churrasqueira. Não invente preço nem quantidade de aluguel.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Pacote atual, se já escolhido.' },
        language: languageProperty,
      },
      required: ['query', 'language'],
      additionalProperties: false,
    },
  },
  {
    name: 'apply_quote_intake_patch',
    description:
      'Atualiza o draft estruturado da conversa. Use para gravar nome, data, horário, convidados, endereço, pacote, opções, extras, churrasqueira e garçom. Não cria cotação.',
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        eventDate: { type: 'string', description: 'YYYY-MM-DD' },
        startTime: { type: 'string', description: 'HH:MM 24h' },
        adultCount: { type: 'number' },
        childrenUnder3Count: { type: 'number' },
        children4To12Count: { type: 'number' },
        childrenZeroAll: { type: 'boolean' },
        address: { type: 'string' },
        formattedAddress: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zipCode: { type: 'string' },
        inventAddress: { type: 'boolean' },
        packageQuery: { type: 'string' },
        packageId: { type: 'string' },
        packageKey: { type: 'string' },
        packagePrice: { type: 'number' },
        confirmPackage: { type: 'boolean' },
        optionGroupId: { type: 'string' },
        optionItemId: { type: 'string' },
        additionalItemId: { type: 'string' },
        additionalItemKey: { type: 'string' },
        additionalQty: { type: 'number' },
        additionalBlockedReason: { type: 'string' },
        hasGrill: { type: 'boolean' },
        waiterQty: { type: 'number' },
        waiterAsked: { type: 'boolean' },
        disposableKitQty: { type: 'number' },
        confirmReview: { type: 'boolean' },
        language: languageProperty,
      },
      required: ['language'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_pending_intake_action',
    description:
      'Resolve a confirmação pendente do draft (pacote, faixas de crianças, review). Use quando o cliente aceita ou recusa o pedido atual. Não use regex no código; chame esta tool.',
    parameters: {
      type: 'object',
      properties: {
        accepted: { type: 'boolean' },
        language: languageProperty,
      },
      required: ['accepted', 'language'],
      additionalProperties: false,
    },
  },
]

export type ExecutedAiTool = {
  name: string
  args: Record<string, unknown>
  data: unknown
  trace: BrasinhaToolTrace
  denied: boolean
}

function readLanguage(
  args: Record<string, unknown>,
  fallback: BrasinhaLanguage,
): BrasinhaLanguage {
  const value = args.language
  return value === 'en' || value === 'es' || value === 'pt' ? value : fallback
}

function readString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (
      key === 'companyId' ||
      key === 'company_id' ||
      key === 'sql' ||
      key === 'serviceRole' ||
      key === 'service_role'
    ) {
      continue
    }
    cleaned[key] = value
  }
  return cleaned
}

function deniedTrace(
  tool: string,
  companyId: string,
  reason: string,
): BrasinhaToolTrace {
  return {
    tool,
    source: 'Lib/brasinha/core/aiTools',
    companyId,
    ids: {},
    timestamp: new Date().toISOString(),
    denied: true,
    reason,
  }
}

export type IntakeToolContext = {
  draft: BrasinhaQuoteDraft
  onDraft: (draft: BrasinhaQuoteDraft) => void
}

function readNumber(args: Record<string, unknown>, key: string): number | null {
  const value = args[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function readBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key]
  return typeof value === 'boolean' ? value : undefined
}

export async function executeAllowedAiTool(input: {
  name: string
  args: Record<string, unknown>
  companyId: string
  language: BrasinhaLanguage
  catalog: BrasinhaCatalogPort
  intake?: IntakeToolContext
}): Promise<ExecutedAiTool> {
  const args = sanitizeArgs(input.args)
  const language = readLanguage(args, input.language)
  const blocked = (BLOCKED_WRITE_TOOLS as readonly string[]).includes(input.name)
  if (blocked || !(ALLOWED_AI_TOOLS as readonly string[]).includes(input.name)) {
    return {
      name: input.name,
      args,
      data: null,
      denied: true,
      trace: deniedTrace(input.name, input.companyId, 'tool_not_exposed'),
    }
  }

  switch (input.name as AllowedAiTool) {
    case 'get_company_public_profile': {
      const result = await input.catalog.getCompanyPublicProfile(
        input.companyId,
        language,
      )
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_packages': {
      const result = await input.catalog.getPackages(input.companyId, language)
      if (input.intake && result.data.length) {
        input.intake.onDraft(rememberOfferedPackages(input.intake.draft, result.data))
      }
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_package_details': {
      const result = await input.catalog.getPackageDetails(
        input.companyId,
        readString(args, 'query'),
        language,
      )
      if (input.intake && result.data) {
        input.intake.onDraft(rememberOfferedPackages(input.intake.draft, [result.data]))
      }
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_catalog_item': {
      const result = await input.catalog.getCatalogItem(
        input.companyId,
        readString(args, 'query'),
        language,
      )
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'search_catalog': {
      const result = await input.catalog.searchCatalog(
        input.companyId,
        readString(args, 'query'),
        language,
      )
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_public_business_rules': {
      const result = await input.catalog.getPublicBusinessRules(input.companyId)
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_quote_by_public_reference': {
      const result = await input.catalog.getQuoteByPublicReference(
        input.companyId,
        readString(args, 'reference'),
      )
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_package_configuration': {
      const result = await input.catalog.getPackageConfiguration(
        input.companyId,
        readString(args, 'query'),
        language,
        input.intake?.draft.package.packageSelections,
      )
      if (result.data && input.intake) {
        input.intake.onDraft(
          applyQuoteIntakePatch(input.intake.draft, {
            requiredOptionGroupIds: result.data.requiredOptionGroups
              .filter((group) => group.required)
              .map((group) => group.id),
          }).draft,
        )
      }
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_available_additionals_for_package': {
      const result = await input.catalog.getAvailableAdditionalsForPackage(
        input.companyId,
        readString(args, 'query'),
        language,
        input.intake?.draft.package.packageSelections,
      )
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_public_service_options': {
      const result = await input.catalog.getPublicServiceOptions(
        input.companyId,
        readString(args, 'query'),
        language,
      )
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'apply_quote_intake_patch': {
      if (!input.intake) {
        return {
          name: input.name,
          args,
          data: null,
          denied: true,
          trace: deniedTrace(input.name, input.companyId, 'intake_unavailable'),
        }
      }
      let draft = input.intake.draft
      const packageQuery = readString(args, 'packageQuery')
      const packageId = readString(args, 'packageId')
      const packageKey = readString(args, 'packageKey')
      const packagePrice = readNumber(args, 'packagePrice')
      if (
        (packageQuery || packageId || packageKey || packagePrice != null) &&
        !draft.conversation.lastOfferedPackages.length
      ) {
        const listed = await input.catalog.getPackages(input.companyId, language)
        draft = rememberOfferedPackages(draft, listed.data)
      }
      if (packageQuery && !packageId && !packageKey && !/^\d+([.,]\d+)?$/.test(packageQuery)) {
        const details = await input.catalog.getPackageDetails(
          input.companyId,
          packageQuery,
          language,
        )
        if (details.data) draft = rememberOfferedPackages(draft, [details.data])
      }
      const extraId = readString(args, 'additionalItemId')
      const extraKey = readString(args, 'additionalItemKey')
      const extraQuery = extraId || extraKey
      let blockedReason: string | null = null
      if (extraQuery && draft.package.packageId) {
        const extras = await input.catalog.getAvailableAdditionalsForPackage(
          input.companyId,
          draft.package.packageKey || draft.package.packageName || draft.package.packageId,
          language,
          draft.package.packageSelections,
        )
        const hit =
          extras.data?.includedInPackage.find(
            (row) => row.id === extraQuery || row.itemKey === extraQuery,
          ) ||
          extras.data?.selectedInPackage.find(
            (row) => row.id === extraQuery || row.itemKey === extraQuery,
          )
        if (hit) {
          blockedReason =
            hit.status === 'SELECTED_IN_PACKAGE'
              ? 'Esse item já está selecionado no seu pacote.'
              : 'Esse item já está incluído no seu pacote.'
        }
      }
      const patch: IntakePatch = {
        firstName: readString(args, 'firstName') || null,
        lastName: readString(args, 'lastName') || null,
        phone: readString(args, 'phone') || null,
        email: readString(args, 'email') || null,
        eventDate: readString(args, 'eventDate') || null,
        startTime: readString(args, 'startTime') || null,
        adultCount: readNumber(args, 'adultCount'),
        childrenUnder3Count: readNumber(args, 'childrenUnder3Count'),
        children4To12Count: readNumber(args, 'children4To12Count'),
        childrenZeroAll: readBoolean(args, 'childrenZeroAll'),
        address: readString(args, 'address') || null,
        formattedAddress: readString(args, 'formattedAddress') || null,
        city: readString(args, 'city') || null,
        state: readString(args, 'state') || null,
        zipCode: readString(args, 'zipCode') || null,
        inventAddress: readBoolean(args, 'inventAddress'),
        packageQuery: packageQuery || null,
        packageId: packageId || null,
        packageKey: packageKey || null,
        packagePrice,
        confirmPackage: readBoolean(args, 'confirmPackage'),
        optionGroupId: readString(args, 'optionGroupId') || null,
        optionItemId: readString(args, 'optionItemId') || null,
        additionalItemId: blockedReason ? null : extraId || null,
        additionalItemKey: extraKey || null,
        additionalQty: readNumber(args, 'additionalQty'),
        additionalBlockedReason: blockedReason,
        hasGrill: readBoolean(args, 'hasGrill'),
        waiterQty: readNumber(args, 'waiterQty'),
        waiterAsked: readBoolean(args, 'waiterAsked'),
        disposableKitQty: readNumber(args, 'disposableKitQty'),
        confirmReview: readBoolean(args, 'confirmReview'),
      }
      const applied = applyQuoteIntakePatch(draft, patch)
      input.intake.onDraft(applied.draft)
      return {
        name: input.name,
        args,
        data: {
          rejected: applied.rejected,
          notes: applied.notes,
          draft: snapshotQuoteDraft(applied.draft),
        },
        denied: Boolean(applied.rejected),
        trace: {
          tool: input.name,
          source: 'Lib/brasinha/intake/apply',
          companyId: input.companyId,
          ids: {
            stage: applied.draft.conversation.currentStage,
            rejected: applied.rejected,
          },
          timestamp: new Date().toISOString(),
          denied: Boolean(applied.rejected),
          reason: applied.rejected ?? undefined,
        },
      }
    }
    case 'resolve_pending_intake_action': {
      if (!input.intake) {
        return {
          name: input.name,
          args,
          data: null,
          denied: true,
          trace: deniedTrace(input.name, input.companyId, 'intake_unavailable'),
        }
      }
      const applied = resolvePendingIntakeAction(
        input.intake.draft,
        args.accepted === true,
      )
      input.intake.onDraft(applied.draft)
      return {
        name: input.name,
        args,
        data: {
          rejected: applied.rejected,
          notes: applied.notes,
          draft: snapshotQuoteDraft(applied.draft),
        },
        denied: Boolean(applied.rejected && applied.rejected !== 'no_pending_action'),
        trace: {
          tool: input.name,
          source: 'Lib/brasinha/intake/apply',
          companyId: input.companyId,
          ids: {
            accepted: args.accepted === true ? 'yes' : 'no',
            stage: applied.draft.conversation.currentStage,
            readyToCreateQuote: applied.draft.conversation.readyToCreateQuote ? 'yes' : 'no',
          },
          timestamp: new Date().toISOString(),
          denied: Boolean(applied.rejected && applied.rejected !== 'no_pending_action'),
          reason: applied.rejected ?? undefined,
        },
      }
    }
    default:
      return {
        name: input.name,
        args,
        data: null,
        denied: true,
        trace: deniedTrace(input.name, input.companyId, 'tool_not_exposed'),
      }
  }
}

const MAX_TOOL_JSON = 2500

export function serializeToolResult(execution: ExecutedAiTool): string {
  const payload = JSON.stringify({
    ok: !execution.denied && execution.data != null,
    tool: execution.name,
    data: execution.data,
    denied: execution.denied,
    reason: execution.trace.reason ?? null,
  })
  if (payload.length <= MAX_TOOL_JSON) return payload
  return `${payload.slice(0, MAX_TOOL_JSON)}…`
}
