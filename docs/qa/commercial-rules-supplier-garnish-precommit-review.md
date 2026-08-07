# Pre-commit review — commercial rules / supplier garnish

**Branch:** `feat/commercial-rules-quote-totals-dev`  
**Data:** 2026-08-07  
**Ambiente:** Supabase DEV `yasprgtlqclwsjcshtls` · CDL `65fd576f-8d97-49ba-bf38-61bc1e94e94a`  
**Baseline HEAD (pré-commit):** `deaacbd`  
**Status short:** ~83 entradas top-level (inclui dirs); untracked expandidos incluem mídia/reports.

**Domínios canônicos:** pausados (não bloqueiam).  
**PROD:** proibido nesta atividade.

---

## Classificação

| Classe | Significado |
|--------|-------------|
| A | FEATURE FUNCIONAL |
| B | BANCO/MIGRATION |
| C | TESTE |
| D | FIXTURE/SEED DEV |
| E | DOCUMENTAÇÃO |
| F | CONFIGURAÇÃO |
| G | TEMPORÁRIO — não commit |
| H | GERADO — não commit (ou só se já versionado) |
| I | SENSÍVEL/PROIBIDO — não commit |

---

## A. FEATURE FUNCIONAL (commit)

### Lib
| Arquivo | Notas |
|---------|--------|
| `Lib/cdlCommercialRules.ts` | M |
| `Lib/commercialRuleGroups.ts` | M |
| `Lib/commercialRulesTableSchema.ts` | M |
| `Lib/defaultCommercialRulesSeed.ts` | M |
| `Lib/calculateQuoteTotals.ts` | M — totais / regras |
| `Lib/calculateQuoteDraftFromSupabasePricing.ts` | M |
| `Lib/buildQuoteSavePayload.ts` | M |
| `Lib/fetchQuoteDetail.ts` | M |
| `Lib/quoteProposal.ts` | M |
| `Lib/whatsappMessageTemplates.ts` | M — templates share/garnish |
| `Lib/i18n/quotesOrders.ts` | M |
| `Lib/orders/fetchServiceOrderDetail.ts` | M — garnish na OS |
| `Lib/orders/writeOperationalAudit.ts` | M |
| `Lib/packageCatalogVisual.ts` | M |
| `Lib/packageDisplay.ts` | M |
| `Lib/liquidGlass.ts` | M (menor) |
| `Lib/supabase/middleware.ts` | M — rota pública garnish |
| `Lib/agenda/week.ts` | M — suporte agenda (já na feature) |
| `Lib/cdlGarnishKits.ts` | **novo** — kits HC–HK |
| `Lib/supplierGarnish.ts` | **novo** |
| `Lib/supplierGarnishKitRule.ts` | **novo** — rule packing |
| `Lib/quotes/applyCommercialMinimums.ts` | **novo** |
| `Lib/usHolidays.ts` | **novo** — datas comemorativas |

### App / API / UI
| Arquivo | Notas |
|---------|--------|
| `app/api/orders/[id]/supplier-garnish/route.ts` | **novo** |
| `app/api/public/confirmacao-guarnicao/[token]/route.ts` | **novo** |
| `app/api/quotes/[id]/reservation-confirm/route.ts` | **novo** |
| `app/api/quotes/[id]/team-assignment/route.ts` | M |
| `app/confirmacao-guarnicao/[token]/page.tsx` | **novo** |
| `app/confirmacao-guarnicao/[token]/PublicSupplierGarnishClient.tsx` | **novo** |
| `app/quotes/new/QuoteWizard.tsx` | M — pacote + autocomplete |
| `app/quotes/[id]/QuoteDetailView.tsx` | M |
| `app/quotes/[id]/QuotePdfDocument.tsx` | M |
| `app/quotes/[id]/quote-print.css` | M |
| `app/quotes/[id]/quoteDetailTypes.ts` | M |
| `app/globals.css` | M |
| `components/orders/SupplierGarnishSharePanel.tsx` | **novo** |
| `components/orders/OrderDetailView.tsx` | M |
| `components/quotes/SelectedPackageDetails.tsx` | M |
| `components/quotes/PackageHeroImage.tsx` | M |
| `components/quotes/QuoteProposalSharePanel.tsx` | M |
| `components/quotes/QuoteTeamAssignmentPanel.tsx` | M |
| `components/quote-review/*` | M + `QuoteCommercialAdjustmentNotice.tsx` novo |
| `components/CdlImportantRulesPanel.tsx` | M |
| `components/CommercialRulesDashboard.tsx` | M |
| `components/CustomersDashboard.tsx` | M |
| `components/QuotesDashboard.tsx` | M |
| `components/QuoteCard.tsx` | M |
| `components/DeleteQuoteButton.tsx` | M |
| `components/rules/RuleCard.tsx` | M |
| `components/agenda/AgendaDashboard.tsx` | M |
| `components/agenda/TeamAvailabilitySharePanel.tsx` | M |
| `components/brand/CateringAuthLogo.tsx` | M (menor) |

---

## B. BANCO/MIGRATION (commit — já aplicadas no DEV)

| Arquivo | Estado DEV |
|---------|------------|
| `supabase/migrations/20260806120000_commercial_rules_reservation_confirm.sql` | local=remote |
| `supabase/migrations/20260806200000_supplier_garnish_confirmation.sql` | local=remote — **não editar** |

`db push --dry-run`: **Remote database is up to date.**

---

## C. TESTE (commit)

| Arquivo |
|---------|
| `scripts/dev/test-commercial-minimums.mjs` |
| `scripts/dev/test-share-commercial-lines.mjs` |
| `scripts/dev/test-supplier-garnish-message.mjs` |

---

## D. FIXTURE/SEED DEV (commit)

| Arquivo |
|---------|
| `scripts/dev/fixtures/commemorative-dates-quotes-v1.json` |
| `scripts/dev/fixtures/mileage-logistics-quotes-v1.json` |
| `scripts/dev/fixtures/supplier-garnish-order-v1.json` |
| `scripts/dev/seed-commemorative-dates-quotes.mjs` |
| `scripts/dev/seed-garnish-share-quotes.mjs` |
| `scripts/dev/seed-grill-rental-quotes.mjs` |
| `scripts/dev/seed-mileage-logistics-quotes.mjs` |
| `scripts/dev/seed-supplier-garnish-kit-rule.mjs` |
| `scripts/dev/seed-supplier-garnish-order.mjs` |
| `scripts/dev/lib/us-holidays.mjs` |
| `scripts/dev/preview-share-messages.mjs` |
| `scripts/dev/apply-supplier-garnish-migration.mjs` |
| `scripts/dev/sync-cdl-commercial-prod-to-dev.mjs` |
| `scripts/dev/sync-cdl-package-images-prod-to-dev.mjs` |
| `scripts/dev/sync-cdl-packages-prod-to-dev.mjs` |

Seeds/syncs: DEV-only, idempotentes, company-scoped. Não executar em PROD.

---

## E. DOCUMENTAÇÃO (commit)

| Arquivo |
|---------|
| `scripts/dev/README.md` |
| `docs/qa/commercial-rules-supplier-garnish-precommit-review.md` (este) |
| `scripts/sql/package-commercial-descriptions.sql` (M) |

---

## F. CONFIGURAÇÃO (commit)

| Arquivo |
|---------|
| `package.json` — scripts seed/verify/test garnish e commercial |

---

## G. TEMPORÁRIO — NÃO COMMITAR

| Path | Motivo |
|------|--------|
| `assets/_video_review/**` | frames/áudio de revisão de vídeo Philippe (~MB) |
| Conteúdo sob `_video_review` | evidência local, não código de produto |

Ignorar via `.gitignore`.

---

## H. GERADO — NÃO COMMITAR (novos)

| Path | Motivo |
|------|--------|
| `scripts/dev/reports/**` | outputs de seed/preview (`supplier-garnish-*.json`, share previews, etc.) |
| `scripts/dev/reports/_last-preview.txt` | artefato local |

`Lib/buildInfo.generated.ts` — já versionado; regenerado no `prebuild`. Incluir só se o diff for coerente com o build da branch.

---

## I. SENSÍVEL / PROIBIDO

| Item | Ação |
|------|------|
| `.env*` | já no `.gitignore` |
| `.vercel` | já no `.gitignore` |
| Tokens / JWT / service role | não versionar |
| Relatórios com telefone fixture | manter em `reports/` (ignorado) |

---

## Decisão de commit (planejada)

1. `feat(rules): …` — regras comerciais, minimums, holidays, reservation-confirm, PDF/share lines  
2. `feat(orders): …` — supplier garnish API + UI + confirmação pública + migration garnish  
3. `feat(garnish): …` — packing HC–HK + kit rule seed/lib  
4. `fix(quotes): …` — wizard pacote/cliente  
5. `test(catering): …` — fixtures/seeds/tests + package.json scripts  
6. `docs(catering): …` — README + este review  

Agenda/team UI changes already in the working tree go with functional commits where they belong (orders/quotes), not a separate agenda feature yet.

---

## Fora deste inventário (preservar intacto)

- `D:\PSCS\worktrees\catering-environments`
- `D:\PSCS\worktrees\catering-homologation`
- Domínios `h.cateringai.app` / `cateringai.app` (pausados)
