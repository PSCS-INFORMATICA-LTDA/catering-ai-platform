# Materiais da OS — Fechamento / Baseline congelada

**Produto:** Catering AI Platform / BBQ At Home / CDL  
**Responsável funcional:** Philippe Santana  
**Branch:** `feat/order-materials-operations-dev`  
**Ambiente:** DEV only — Supabase `yasprgtlqclwsjcshtls`  
**Preview estável:** https://catering-ai-agenda-dev.vercel.app  
**Demo OS:** `SO-TEST-DEV-BOM` · `/orders/f2400000-0000-4000-8000-0000000000b1`

---

## Status

**MATERIAIS — BASELINE CONGELADA**

| Campo | Valor |
|-------|--------|
| `MATERIALS_BASELINE_HEAD` | `e9a213597a6fb685ffa7568eb1f6a03ef62b377f` |
| HEAD inicial desta rodada | `74db72f56e3ca4de41b899dcdcff5e9f0341f4f3` |
| Production / main / homologation | Intactas |
| Logistics | Intacto |
| Migration / tabela de estoque | Nenhuma |

---

## 1. Fase 1 — Materiais operacionais

- Tabela `service_order_materials` (separada de `service_order_items` comercial e do checklist).
- Quantidades: `required` → `separated` → `checked`.
- Status: `pending | partial | separated | checked | divergence | cancelled` (+ estendidos na Fase 2).
- RBAC: `orders.materials.view | prepare | check`.
- UI: painel Materiais na OS.
- Seed: `SO-TEST-DEV-MATERIALS`.

## 2. Fase 1.5 — BOM

- `operational_material_rules` (package/additional → materiais).
- Geração automática na conversão Quote → OS (`generateOrderMaterialsFromBom`).
- Tipos de regra: fixed / per_guest / tier; rounding; snapshot na OS.
- Seed: `SO-TEST-DEV-BOM`.

## 3. Segregação financeira

- Permissão `orders.financial.view` (owner/admin/sales/finance; **não** operator/manager/kitchen/viewer por default).
- Serializer `Lib/orders/sanitizeServiceOrderFinancial.ts`.
- Operação: payload/UI sem price/total/cost/margin/discount/deposit/balance.
- Itens vendidos para ops: nome/tipo/qty apenas.

## 4. Fase 2 — Saída / retorno / sobra

- Colunas: `dispatched_*`, `returned_*`, `leftover_quantity`, `return_notes`, `stock_posting_status` (`pending|posted|not_applicable`) — **sem postagem de estoque**.
- Tabela `service_order_material_dispatch_confirmations` (token **SHA-256**, expiry, revoke).
- Rota pública `/conferencia-saida/[token]`.
- RBAC: `orders.materials.dispatch`, `orders.materials.return`.
- WhatsApp prepare no backoffice da OS.
- Seeds/QA: `seed:dev:order-materials-phase2`, `test:dev:order-material-dispatch|return|public-security`.

## 5. Hardening — shell público

- `AuthenticatedShell` trata `/conferencia-saida/` como path público (junto a designação/confirmação equipe/guarnição).
- Cenários A/B/C (sem sessão, admin logado, operator logado): **sem** AppShell/sidebar/backoffice.
- **Não** faz logout; sessão permanece válida ao voltar ao backoffice.

## 6. Hardening — i18n PT / EN / ES

- Chaves `publicDispatch*` em `Lib/i18n/quotesOrders.ts` (três locales).
- URL: `?lang=pt|en|es` via `buildPublicMaterialDispatchUrl` + `resolvePublicDispatchLocale` (query → líder → Accept-Language → PT).
- Página/cliente usam `tQuotesOrders` — sem copy funcional PT hardcoded relevante.

## 7. Token

- Token plaintext só no link; persistido como `token_hash`.
- Estados: pending / confirmed / expired / revoked.
- Payload público: zero financeiro, zero JWT, zero `token_hash`.

## 8. Retorno / sobras

- Retorno por tipo (equipment/returnable/consumable/disposable) com regras de divergência.
- Sobra (`leftover_quantity`) operacional — **não** movimenta estoque nesta fase.
- Fechamento quando consistente.

## 9. Helpers QA

| Helper | Destino |
|--------|---------|
| mint token / evidence / ensure-ops-qa | `scripts/dev/qa/` |
| debug RPC / confirm-os-bom descartáveis | removidos |
| Auth `_*.mjs` locais | gitignored — fora do escopo Materiais |

Scripts npm: `qa:dev:mint-material-dispatch-token`, `qa:dev:materials-phase2-evidence`, `test:dev:order-material-dispatch-i18n`.

## 10. QA / regressões (rodada de fechamento)

| Suite | Resultado |
|-------|-----------|
| `test:dev:order-material-dispatch-i18n` | PASS |
| `test:dev:order-material-dispatch` | PASS |
| `test:dev:order-material-return` | PASS |
| `test:dev:order-material-public-security` | PASS |
| `test:dev:order-materials` | PASS |
| `test:dev:order-material-preparation` | PASS |
| `test:dev:order-material-check` | PASS |
| `test:dev:materials-bom` | PASS |
| `test:dev:order-financial-rbac` | PASS |
| `qa:dev:schedule-conflict-matrix` | 12/12 PASS |
| `verify:dev:team-scale` | PASS |
| `verify:dev:functional` | PASS |
| `verify:dev:supplier-garnish` | PASS |
| `test:dev:quotes-orders:preflight` | PASS |
| `npm run build` | PASS |

## 11. Explicitamente fora de escopo

- Estoque / warehouse / ledger / saldo / movements
- Valuation / custo médio / FIFO / LIFO / AP
- Merge `main` / Production / homologation / `--prod`
- Alterações no domínio Logistics
- UOM formal
- Qualquer migration de inventário

## 12. Próximo passo

Discovery de Estoque: `docs/architecture/inventory-discovery.md` (somente mapeamento — sem código).
