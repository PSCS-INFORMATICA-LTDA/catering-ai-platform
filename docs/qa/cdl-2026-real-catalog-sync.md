# CDL 2026 — DEV commercial catalog sync

**SOURCE OF TRUTH:** CDL 2026 text provided by the PO  
**PDF NEEDED BY AGENT:** NO  
**PROD ALTERADO:** NÃO  
**ENVIRONMENT:** DEV `yasprgtlqclwsjcshtls`  
**COMPANY:** `65fd576f-8d97-49ba-bf38-61bc1e94e94a`  
**URL:** https://catering-ai-agenda-dev.vercel.app

## Counts

| | |
|---|---|
| TOTAL PUBLIC ITEMS BEFORE | 75 |
| TOTAL PUBLIC ITEMS AFTER | 75 |
| PUBLIC_NON_SOURCE_ITEM_COUNT | 0 |
| PLACEHOLDER_EVENT_ITEMS | 0 |
| FEIJÃO TROPEIRO PÚBLICO | NO |

The after-count stays 75 because 9 non-source public SKUs were removed, 4 real condiments moved into ACOMPANHAMENTOS, and 5 missing source SKUs were created.

## Created from this source

| Item | Category | Price | Type |
|---|---|---|---|
| CHIMICHURRI | ACOMPANHAMENTOS | $1 | PER_PERSON |
| FILÉ MIGNON | BOVINO_NOBRE | $15 | PER_PERSON |
| FILÉ MIGNON | PORCO | $12 | PER_PERSON |
| CARANGUEJO REI | FRUTOS_DO_MAR | $50 | PER_PERSON |
| PURÊ DE BATATA | GUARNICOES | $3 | PER_PERSON |

## Deleted (no real quote history)

QUEIJO MUSSARELA, COSTELA DE CORDEIRO, LIMÃO, TOMATE, SALPICÃO DE CARNE SECA, SOBRECOXA (SEM OSSO) duplicate, PORCO COM QUEIJO, GELÉIA DE HORTELÃ, PIMENTA DO REINO, BARBECUE, Linguiça Tradicional duplicada inativa.

## Preserved for real quote history only

Removed from the current public catalog (`customer_visible=false`, `can_be_additional=false`):

| Item | Quote extra rows |
|---|---|
| FRALDINHA (generic) | 5 |
| HAMBÚRGUER ANGUS | 5 |
| FRANGO COM QUEIJO | 3 |
| FEIJÃO TROPEIRO | 1 |

No CASCADE on those rows.

## Final public categories

1. EXTRAS SUGERIDOS (virtual: unit extras)
2. BOVINO NOBRE
3. BOVINO TRADICIONAL
4. PORCO
5. CORDEIRO
6. FRANGO
7. LINGUIÇAS
8. FRUTOS DO MAR
9. LEGUMES E VEGETAIS
10. FRUTAS
11. ACOMPANHAMENTOS
12. GUARNIÇÕES
13. EQUIPAMENTOS (grill rental only)

PEIXES and CONDIMENTOS are not public. Empty categories are not rendered.

## GUARNIÇÕES finais (UPPERCASE, price desc)

SALPICÃO DE FRANGO $7 · FEIJÃO PRETO $5 · MAIONESE $5 · VINAGRETE $5 · ARROZ BRANCO $4 · FAROFA TEMPERADA $3 · MANDIOCA COZIDA $3 · SALADA CÉSAR $3 · PURÊ DE BATATA $3

## Conflicts reported, not changed

- `PDF_LUXURY_CONFLICT = YES` — BBQ Luxury $150 exists in one page of the material; the main package summary is 4 packages. **Not created.** `PO_DECISION_REQUIRED = YES`
- `PDF_CUSTOM_MINIMUM = 50` / `SYSTEM_CURRENT_CUSTOM = SOB_CONSULTA` — Personalizado left unchanged. `PO_DECISION_REQUIRED = YES`

Seasonal December/January rules, cancellation policy, and commercial minimums were not modified.

## Packages (unchanged)

BBQTRAD $45 · BBQSEL $55 · BBQCHO $65 · BBQPRI $75  
BBQTRAD+ $58 · BBQSEL+ $68 · BBQCHO+ $78 · BBQPRI+ $88  
PLUS $13 / person · Personalizado sob consulta
