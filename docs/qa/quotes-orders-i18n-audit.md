# Auditoria i18n — Cotações e Ordens

**Branch:** `chore/quotes-orders-hardening-i18n-tests-dev`  
**Padrão existente:** `Lib/i18n/quotesOrders.ts` + `useAuthLocale` / `preferred_language` (sem second library)

## Legenda

| Status | Significado |
|--------|-------------|
| completo | chave PT/EN/ES + wiring |
| parcial | dict existe, UI ainda hardcoded ou locale default pt |
| ausente | sem chave |
| hardcoded | texto fixo na UI |
| dado | não traduzir |

## Matriz inicial (pré-correção)

| Tela/Componente | Texto | PT | EN | ES | Hardcoded | Ação | Status (inicial) |
|-----------------|-------|----|----|----|-----------|------|--------|
| `quotesOrders.ts` dict | títulos/filtros/status/checklist | sim | sim | sim | n/a | manter | completo (dict) |
| `QuotesDashboard` | título, filtros, ações | — | — | — | sim PT | wire `tQuotesOrders` + locale | parcial |
| `OrdersDashboard` | título/filtros | — | — | — | sim PT | wire | parcial |
| `OrdersDashboard` | status label | via helper | via helper | via helper | locale default pt | passar locale | parcial |
| `OrderDetailView` | ações/histórico/checklist UI | — | — | — | sim PT | wire | parcial |
| `QuoteConvertPanel` | textos convert | — | — | — | sim PT | wire | parcial |
| `QuoteProposalSharePanel` | share UI | — | — | — | sim PT | wire chaves feature | parcial |
| `QuoteTeamAssignmentPanel` | designação UI | — | — | — | sim PT | wire | parcial |
| `QuoteDetailView` | blocos comerciais | — | — | — | sim PT | wire labels | parcial |
| `navConfig` Agenda/Cotações/OS | menu | — | — | — | sim PT | labels traduzíveis no shell da feature | parcial |
| PDF chrome | Cliente/Evento/Pacote | misto | misto | — | sim | dict PDF por `quote.language` | parcial |
| PDF catálogo | nomes pacote/itens | via language | via language | via language | n/a | manter | completo |
| Nomes/e-mails/endereços/números | dados | — | — | — | n/a | não traduzir | dado |

## Locale

- UI staff: `app_users.preferred_language` → `/api/auth/me` → `useAuthLocale(me.locale)`
- Documento/PDF: `quotes.language`
- Fallback técnico `pt` permitido; testes i18n devem falhar se chave da feature faltar em EN/ES

## Pós-correção (status final — HARDENING DEV)

Todas as linhas abaixo foram atualizadas para **completo**, exceto **dado** (nomes/e-mails/endereços/números e o texto legal de `Lib/cdlCommercialRules.ts`, tratado como conteúdo/política e não como UI a traduzir).

| Tela/Componente | PT | EN | ES | Wiring | Status (final) |
|-----------------|----|----|----|--------|--------|
| `Lib/i18n/quotesOrders.ts` dict | sim | sim | sim | 225 chaves, paridade estrutural garantida por `test-quotes-orders-i18n.mjs` | completo |
| `Lib/i18n/useAuthLocaleFromMe.ts` (novo hook) | n/a | n/a | n/a | busca `/api/auth/me` e resolve `AuthLocale`, evita hydration mismatch | completo |
| `components/QuotesDashboard.tsx` | sim | sim | sim | `useAuthLocaleFromMe` + `tQuotesOrders` | completo |
| `components/orders/OrdersDashboard.tsx` | sim | sim | sim | `useAuthLocaleFromMe` + `tQuotesOrders`, status label recebe locale | completo |
| `components/orders/OrderDetailView.tsx` | sim | sim | sim | `useAuthLocaleFromMe` + `tQuotesOrders` (ações/histórico/checklist) | completo |
| `components/quotes/QuoteConvertPanel.tsx` | sim | sim | sim | `useAuthLocaleFromMe` + `tQuotesOrders` | completo |
| `components/quotes/QuoteProposalSharePanel.tsx` | sim | sim | sim | UI chrome traduzida via `tQuotesOrders`; templates de mensagem mantidos por `language` (já multi-idioma) | completo |
| `components/quotes/QuoteTeamAssignmentPanel.tsx` | sim | sim | sim | UI chrome traduzida via `tQuotesOrders` | completo |
| `app/quotes/[id]/QuoteDetailView.tsx` | sim | sim | sim | `tQuotesOrders(quote.language, key)` para labels/seções da proposta | completo |
| `app/quotes/[id]/QuoteDetailToolbar.tsx` | sim | sim | sim | `useAuthLocaleFromMe` + `tQuotesOrders` (Voltar/Editar/Imprimir) | completo |
| `components/layout/CateringSidebar.tsx` (nav Agenda/Cotações/Ordens) | sim | sim | sim | `getNavLabel(locale, href, fallback)` via `NAV_HREF_KEY_MAP`, sem reescrever o nav global | completo |
| PDF chrome (`app/quotes/[id]/QuotePdfDocument.tsx`) | sim | sim | sim | `tQuotesOrders(quote.language, key)` para todos os rótulos de seção/campo; totais/layout/fórmula inalterados | completo |
| PDF catálogo (nomes pacote/itens/regras comerciais) | via language | via language | via language | mantido como estava (regras comerciais tratadas como dado/política) | completo (mantido) |
| Nomes/e-mails/endereços/números | — | — | — | não traduzir | dado |

Verificado automaticamente por `scripts/dev/test-quotes-orders-i18n.mjs` (paridade estrutural PT/EN/ES + varredura de frases PT hardcoded conhecidas + wiring básico presente nos 8 arquivos de feature).
