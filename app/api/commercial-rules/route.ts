import {
  CANCELLATION_POLICY_SUMMARY,
  IMPORTANT_RULES,
  RESERVATION_PAYMENT_TEXT,
} from '@/Lib/cdlCommercialRules'
import {
  buildCommercialRulesListSelect,
  parseCommercialRuleValue,
  pickCommercialRulesInsertPayload,
  type CommercialRuleRow,
  type CommercialRuleValue,
} from '@/Lib/commercialRulesTableSchema'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import {
  fetchSupabaseCommercialRules,
  getFallbackCommercialRules,
  type CommercialRulesSnapshot,
} from '@/Lib/supabaseCommercialRules'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RULE_TABLE = 'commercial_rules'

function db() {
  return getSupabaseServerClient()
}

function buildTextRules() {
  return {
    reservationPayment: RESERVATION_PAYMENT_TEXT,
    cancellation: [...CANCELLATION_POLICY_SUMMARY],
    minimumOrder: [...IMPORTANT_RULES.minimumOrder],
    mileage: [...IMPORTANT_RULES.mileage],
    reservation: [...IMPORTANT_RULES.reservation],
    foodPolicy: [...IMPORTANT_RULES.foodPolicy],
    latePayment: [...IMPORTANT_RULES.latePayment],
    decemberJanuary: [...IMPORTANT_RULES.decemberJanuary],
    quoteValidityDays: 7,
  }
}

async function tableExists(): Promise<boolean> {
  const { error } = await db().from(RULE_TABLE).select('id').limit(1)
  return !error
}

async function fetchRuleRows(activeOnly: boolean): Promise<CommercialRuleRow[]> {
  const companyId = getCdlCompanyId()
  let query = db()
    .from(RULE_TABLE)
    .select(buildCommercialRulesListSelect())
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('rule_key', { ascending: true })

  if (activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) {
    console.error('[commercial-rules] fetchRuleRows:', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const typed = row as unknown as Record<string, unknown>
    return {
      ...typed,
      rule_value: parseCommercialRuleValue(typed.rule_value),
    } as CommercialRuleRow
  })
}

function normalizeRuleValueInput(
  body: Partial<CommercialRuleRow>,
): CommercialRuleValue | null {
  if (body.rule_value) {
    return parseCommercialRuleValue(body.rule_value)
  }
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const activeParam = url.searchParams.get('active')
  const activeOnly = activeParam !== 'all'

  const exists = await tableExists()
  const rules: CommercialRulesSnapshot = await fetchSupabaseCommercialRules()
  const rows = exists ? await fetchRuleRows(activeOnly) : []

  return Response.json(
    {
      rules,
      rows,
      editable: exists,
      table: exists ? RULE_TABLE : null,
      textRules: buildTextRules(),
      fallback: getFallbackCommercialRules(),
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}

export async function POST(request: Request) {
  const exists = await tableExists()
  if (!exists) {
    return Response.json(
      { error: 'Tabela commercial_rules não encontrada. Execute a migration SQL.' },
      { status: 409 },
    )
  }

  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return Response.json({ error: 'company_id não configurado.' }, { status: 500 })
  }

  let body: Partial<CommercialRuleRow>
  try {
    body = (await request.json()) as Partial<CommercialRuleRow>
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const ruleKey = body.rule_key?.trim()
  if (!ruleKey) {
    return Response.json({ error: 'rule_key é obrigatório.' }, { status: 400 })
  }

  const ruleValue = normalizeRuleValueInput(body)
  if (!ruleValue) {
    return Response.json({ error: 'rule_value é obrigatório.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const insertPayload = {
    ...pickCommercialRulesInsertPayload({
      company_id: companyId,
      rule_key: ruleKey,
      rule_value: ruleValue,
      active: body.active !== false,
    }),
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await db()
    .from(RULE_TABLE)
    .insert(insertPayload)
    .select(buildCommercialRulesListSelect())
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const typed = data as unknown as Record<string, unknown>
  return Response.json({
    data: {
      ...typed,
      rule_value: parseCommercialRuleValue(typed.rule_value),
    },
  })
}

export async function PATCH(request: Request) {
  const exists = await tableExists()
  if (!exists) {
    return Response.json(
      { error: 'Tabela commercial_rules não encontrada.' },
      { status: 409 },
    )
  }

  let body: Partial<CommercialRuleRow> & { id?: string }
  try {
    body = (await request.json()) as Partial<CommercialRuleRow> & { id?: string }
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  if (!body.id?.trim()) {
    return Response.json({ error: 'id é obrigatório.' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.rule_key !== undefined) {
    updatePayload.rule_key = body.rule_key
  }
  if (body.active !== undefined) {
    updatePayload.active = body.active
  }
  if (body.rule_value) {
    const existing = await db()
      .from(RULE_TABLE)
      .select('rule_value')
      .eq('id', body.id)
      .maybeSingle()

    const current = parseCommercialRuleValue(
      (existing.data as { rule_value?: unknown } | null)?.rule_value,
    )
    const incoming = parseCommercialRuleValue(body.rule_value)
    if (incoming) {
      updatePayload.rule_value = {
        ...(current ?? {}),
        ...incoming,
      }
    }
  }

  const { data, error } = await db()
    .from(RULE_TABLE)
    .update(updatePayload)
    .eq('id', body.id)
    .select(buildCommercialRulesListSelect())
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const rules: CommercialRulesSnapshot = await fetchSupabaseCommercialRules()
  const typed = data as unknown as Record<string, unknown>
  return Response.json({
    data: {
      ...typed,
      rule_value: parseCommercialRuleValue(typed.rule_value),
    },
    rules,
  })
}
