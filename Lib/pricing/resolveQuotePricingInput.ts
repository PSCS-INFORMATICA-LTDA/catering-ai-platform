import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import { fetchPackages, type PackageListItem } from '@/Lib/fetchPackages'
import type { QuoteAdditionalSaveLine } from '@/Lib/buildQuoteSavePayload'
import {
  calcAdditionalLineTotal,
  type GuestCounts,
} from '@/Lib/calculateQuoteTotals'
import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import { getCatalogItemSalePrice } from '@/Lib/itemCatalog'
import { getPackagePrice } from '@/Lib/packageFieldAccess'
import { isPerPersonAdditional } from '@/Lib/quoteAdditionalDisplay'
import { getActiveCompanyId } from '@/Lib/tenant/resolveTenant'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { PricingConfigurationError } from './pricingBreakdownTypes'

export type QuotePricingSelectionInput = {
  packageId: string
  additionals: Array<{ itemId: string; quantity: number }>
  guestCounts: GuestCounts
  language?: 'pt' | 'en' | 'es' | null
}

export type ResolvedQuotePricingContext = {
  companyId: string
  package: PackageListItem
  packagePricePerPerson: number
  catalogById: Map<string, CatalogItemListItem>
  guestCounts: GuestCounts
  language: 'pt' | 'en' | 'es'
}

export type ResolveQuotePricingResult =
  | {
      ok: true
      context: ResolvedQuotePricingContext
      resolvedAdditionals: QuoteAdditionalSaveLine[]
    }
  | { ok: false; error: PricingConfigurationError }

function isMissingPrice(value: number | null | undefined): boolean {
  return value == null || !Number.isFinite(Number(value))
}

export async function resolveQuotePricingInput(
  input: QuotePricingSelectionInput,
): Promise<ResolveQuotePricingResult> {
  const companyId = getActiveCompanyId()?.trim()
  if (!companyId) {
    return {
      ok: false,
      error: {
        code: 'missing_commercial_rule',
        message: 'company_id não resolvido para precificação.',
        field: 'company_id',
      },
    }
  }

  const packageId = input.packageId?.trim()
  if (!packageId) {
    return {
      ok: false,
      error: {
        code: 'missing_package',
        message: 'Pacote é obrigatório para precificação.',
        field: 'package_id',
      },
    }
  }

  const supabase = getSupabaseServerClient()
  const { data: packageRow, error: packageError } = await supabase
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .maybeSingle()

  if (packageError) {
    return {
      ok: false,
      error: {
        code: 'missing_package',
        message: `Erro ao carregar pacote: ${packageError.message}`,
        field: 'package_id',
      },
    }
  }

  if (!packageRow) {
    return {
      ok: false,
      error: {
        code: 'missing_package',
        message: 'Pacote não encontrado ou fora do tenant.',
        field: 'package_id',
      },
    }
  }

  const pkg = packageRow as PackageListItem
  if (isMissingPrice(pkg.price_per_person)) {
    return {
      ok: false,
      error: {
        code: 'missing_package_price',
        message: `Preço por pessoa não configurado para o pacote "${pkg.label_pt ?? pkg.package_key ?? packageId}".`,
        field: 'price_per_person',
      },
    }
  }

  const packagePricePerPerson = getPackagePrice(pkg)
  const selectedLines = (input.additionals ?? []).filter(
    (line) => line.itemId?.trim() && line.quantity > 0,
  )

  const catalogIds = [...new Set(selectedLines.map((line) => line.itemId.trim()))]
  let catalogItems: CatalogItemListItem[] = []

  if (catalogIds.length > 0) {
    const catalogRes = await fetchCatalogItems({
      activeOnly: true,
      usage: 'additional',
      audience: 'customer',
    })
    if (catalogRes.error) {
      return {
        ok: false,
        error: {
          code: 'missing_catalog_item',
          message: `Erro ao carregar catálogo: ${catalogRes.error.message}`,
        },
      }
    }
    catalogItems = (catalogRes.data ?? []) as CatalogItemListItem[]
  }

  const catalogById = new Map(catalogItems.map((item) => [item.id, item]))

  const language =
    input.language === 'en' || input.language === 'es' || input.language === 'pt'
      ? input.language
      : 'pt'

  const resolvedAdditionals: QuoteAdditionalSaveLine[] = []

  for (const line of selectedLines) {
    const itemId = line.itemId.trim()
    const catalog = catalogById.get(itemId)
    if (!catalog) {
      return {
        ok: false,
        error: {
          code: 'missing_catalog_item',
          message: `Adicional não encontrado ou indisponível: ${itemId}.`,
          field: itemId,
        },
      }
    }

    const unitPrice = getCatalogItemSalePrice(catalog)
    if (isMissingPrice(unitPrice) && line.quantity > 0) {
      return {
        ok: false,
        error: {
          code: 'missing_catalog_price',
          message: `Preço não configurado para o adicional "${catalog.label_pt ?? catalog.item_name ?? itemId}".`,
          field: itemId,
        },
      }
    }

    const perPerson = isPerPersonAdditional(
      catalog as Parameters<typeof isPerPersonAdditional>[0],
    )
    const billablePlaceholder = 1
    const totalPrice = calcAdditionalLineTotal(
      { quantity: line.quantity, unitPrice, perPerson },
      perPerson ? billablePlaceholder : billablePlaceholder,
    )

    resolvedAdditionals.push({
      itemId,
      quantity: line.quantity,
      unitPrice,
      perPerson,
      totalPrice,
    })
  }

  return {
    ok: true,
    context: {
      companyId,
      package: pkg,
      packagePricePerPerson,
      catalogById,
      guestCounts: input.guestCounts,
      language,
    },
    resolvedAdditionals,
  }
}

/** Lista pacotes ativos do tenant — usado em QA e validação de edição. */
export async function fetchTenantActivePackages() {
  const companyId = getActiveCompanyId()
  const { data, error } = await fetchPackages({ activeOnly: true })
  return { companyId, data: data ?? [], error }
}

/** Verifica isolamento: quote de outro tenant não deve ser legível. */
export async function quoteBelongsToCompany(
  quoteId: string,
  companyId: string,
): Promise<boolean> {
  const supabase = getSupabaseServerClient()
  const { data } = await supabase
    .from('quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()
  return Boolean(data?.id)
}
