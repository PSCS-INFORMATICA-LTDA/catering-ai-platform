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

export async function executeAllowedAiTool(input: {
  name: string
  args: Record<string, unknown>
  companyId: string
  language: BrasinhaLanguage
  catalog: BrasinhaCatalogPort
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
      return { name: input.name, args, data: result.data, denied: false, trace: result.trace }
    }
    case 'get_package_details': {
      const result = await input.catalog.getPackageDetails(
        input.companyId,
        readString(args, 'query'),
        language,
      )
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
