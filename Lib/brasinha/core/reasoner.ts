import { getCompanyPersona, personaIntro } from '../persona.ts'
import { handoffReply } from '../policy.ts'
import type { BrasinhaCatalogPort } from '../tools/types.ts'
import type {
  BrasinhaLanguage,
  BrasinhaReasonerKind,
  BrasinhaStoredMessage,
  BrasinhaToolTrace,
} from '../types.ts'
import {
  catalogReply,
  extraHourHandoffReply,
  grillReply,
  packageDetailsReply,
  packagesReply,
  quoteIntentReply,
  quoteStatusReply,
  rulesReply,
  serviceTimingReply,
  socialReply,
  waiterReply,
} from './copy.ts'
import {
  detectBrasinhaIntent,
  extractGuestCount,
  extractPackageQuery,
} from './intent.ts'
import { detectSocialTurn, extractCustomerName } from './social.ts'

export type BrasinhaReasonerInput = {
  companyId: string
  language: BrasinhaLanguage
  text: string
  catalog: BrasinhaCatalogPort
  history?: BrasinhaStoredMessage[]
}

export type BrasinhaReasonerResult = {
  text: string
  traces: BrasinhaToolTrace[]
  toolsCalled: string[]
  handoff: string | null
  provider?: BrasinhaReasonerKind
  model?: string | null
  providerFailure?: boolean
  providerErrorStatus?: string | null
  providerErrorCode?: string | null
  providerErrorType?: string | null
}

export type BrasinhaReasoner = {
  kind: BrasinhaReasonerKind
  answer(input: BrasinhaReasonerInput): Promise<BrasinhaReasonerResult>
}

export async function answerDeterministicIntent(
  input: BrasinhaReasonerInput,
): Promise<BrasinhaReasonerResult> {
  const persona = getCompanyPersona(input.companyId)
  const social = detectSocialTurn(input.text)
  if (social) {
    return {
      text: socialReply(
        input.language,
        social,
        extractCustomerName(input.text),
        input.text,
      ),
      traces: [],
      toolsCalled: [],
      handoff: null,
      provider: 'deterministic',
    }
  }
  const intent = detectBrasinhaIntent(input.text)
  const traces: BrasinhaToolTrace[] = []
  const toolsCalled: string[] = []

  if (intent === 'extra_service_hour') {
    return {
      text: extraHourHandoffReply(input.language),
      traces,
      toolsCalled,
      handoff: 'extra_service_hour',
    }
  }

  if (intent === 'service_timing') {
    const rules = await input.catalog.getPublicBusinessRules(input.companyId)
    traces.push(rules.trace)
    toolsCalled.push(rules.trace.tool)
    const hours = Number(rules.data.serviceDurationHours)
    const lead = Number(rules.data.crewSetupLeadMinutes)
    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(lead) || lead < 0) {
      return {
        text: handoffReply(input.language),
        traces,
        toolsCalled,
        handoff: 'unknown_rule',
      }
    }
    return {
      text: serviceTimingReply(input.language, rules.data),
      traces,
      toolsCalled,
      handoff: null,
    }
  }

  if (intent === 'list_packages') {
    const packages = await input.catalog.getPackages(input.companyId, input.language)
    traces.push(packages.trace)
    toolsCalled.push(packages.trace.tool)
    return {
      text: `${personaIntro(input.language, persona)}\n\n${packagesReply(input.language, packages.data)}`,
      traces,
      toolsCalled,
      handoff: packages.data.length ? null : 'unknown_rule',
    }
  }

  if (intent === 'package_details') {
    const query = extractPackageQuery(input.text)
    const details = await input.catalog.getPackageDetails(
      input.companyId,
      query,
      input.language,
    )
    traces.push(details.trace)
    toolsCalled.push(details.trace.tool)
    const body = packageDetailsReply(input.language, details.data)
    return {
      text: body ?? handoffReply(input.language),
      traces,
      toolsCalled,
      handoff: body ? null : 'unknown_rule',
    }
  }

  if (intent === 'grill_rental' || intent === 'waiter' || intent === 'public_rules') {
    const rules = await input.catalog.getPublicBusinessRules(input.companyId)
    traces.push(rules.trace)
    toolsCalled.push(rules.trace.tool)
    if (intent === 'grill_rental') {
      const grill = await input.catalog.getCatalogItem(
        input.companyId,
        'ITEM_084',
        input.language,
      )
      traces.push(grill.trace)
      toolsCalled.push(grill.trace.tool)
      return {
        text: grillReply(
          input.language,
          grill.data?.price ?? rules.data.grillRentalFee,
        ),
        traces,
        toolsCalled,
        handoff: null,
      }
    }
    if (intent === 'waiter') {
      const waiter = await input.catalog.getCatalogItem(
        input.companyId,
        'CDL_WAITER_SERVICE',
        input.language,
      )
      traces.push(waiter.trace)
      toolsCalled.push(waiter.trace.tool)
      return {
        text: waiterReply(
          input.language,
          rules.data.waiterServiceFee,
          waiter.data,
        ),
        traces,
        toolsCalled,
        handoff: waiter.data?.price == null && !rules.data.waiterServiceFee
          ? 'unknown_rule'
          : null,
      }
    }
    return {
      text: rulesReply(input.language, rules.data),
      traces,
      toolsCalled,
      handoff: null,
    }
  }

  if (intent === 'catalog_search') {
    const hits = await input.catalog.searchCatalog(
      input.companyId,
      input.text,
      input.language,
    )
    traces.push(hits.trace)
    toolsCalled.push(hits.trace.tool)
    const body = catalogReply(input.language, hits.data)
    return {
      text: body || handoffReply(input.language),
      traces,
      toolsCalled,
      handoff: body ? null : 'unknown_rule',
    }
  }

  if (intent === 'quote_status') {
    const reference = input.text.match(/Q-\d{4}-\d+/i)?.[0] ?? ''
    const found = await input.catalog.getQuoteByPublicReference(
      input.companyId,
      reference,
    )
    traces.push(found.trace)
    toolsCalled.push(found.trace.tool)
    return {
      text: quoteStatusReply(input.language, found.data),
      traces,
      toolsCalled,
      handoff: found.data ? null : 'unknown_rule',
    }
  }

  if (intent === 'quote_intent') {
    traces.push({
      tool: 'create_quote_draft',
      source: 'blocked:canonical_submit_not_reused',
      companyId: input.companyId,
      ids: {},
      timestamp: new Date().toISOString(),
      denied: true,
      reason: 'write_not_implemented',
    })
    toolsCalled.push('create_quote_draft')
    return {
      text: quoteIntentReply(input.language, extractGuestCount(input.text)),
      traces,
      toolsCalled,
      handoff: null,
    }
  }

  return {
    text: handoffReply(input.language),
    traces,
    toolsCalled,
    handoff: 'unknown_rule',
  }
}

export function createDeterministicReasoner(): BrasinhaReasoner {
  return {
    kind: 'deterministic',
    answer: answerDeterministicIntent,
  }
}
