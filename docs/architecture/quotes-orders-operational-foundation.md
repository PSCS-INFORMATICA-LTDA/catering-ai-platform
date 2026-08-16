# Arquitetura — Fundação operacional Cotações → Ordem de Serviço

**Produto:** Catering AI Platform  
**Branch:** `feat/quotes-orders-operational-foundation-dev`  
**Ambiente alvo:** Supabase DEV `yasprgtlqclwsjcshtls`  
**ADR:** `docs/adr/quote-order-data-model-decision.md`  
**Spec:** `docs/specs/quote-to-order-functional-spec.md`

---

## 1. Objetivo

Consolidar o domínio comercial de Cotações e criar a fundação operacional **Cotação aceita → Ordem de Serviço**, reutilizando Evento, Agenda, Equipes e proposta pública existentes — sem Financeiro/DRE/Dashboard.

---

## 2. Estado auditado (pré-implementação)

| Capacidade | Estado |
|------------|--------|
| CRUD cotações + totais 2830 + PDF | TEM |
| Lista cotações | Cards (`QuotesDashboard`) — a consolidar em lista |
| Proposta pública + aceite/rejeição | TEM (`proposal_*` em `quotes`) |
| Designação de equipe + `agenda_events` | TEM |
| `quote_versions` | NÃO TEM (só `quotes.version` int) |
| `service_orders` / conversão | NÃO TEM (helpers de número prontos) |
| `audit_logs` writers no app | NÃO TEM |
| Status quote | Livre varchar; UI: draft/sent/approved/cancelled |

---

## 3. Domínios e limites

```
[Comercial] quotes + quote_versions + proposal_*
     │ aceite
     ▼
[Operacional] service_orders + checklist + status_history
     │ vínculo
     ▼
[Agenda] agenda_events (existente) ←→ operational_teams
[Ocorrência] events (existente, quote.event_id)
```

Fora de escopo: AR/AP, DRE, dashboard `/dashboard`, estoque, IA, envio automático WA/e-mail, frota.

---

## 4. Componentes novos (alvo)

### Banco

- `quote_versions`
- `service_orders` (+ unique company+quote_version)
- `service_order_items` (linhas do snapshot para consulta)
- `service_order_status_history`
- `service_order_checklist_items`
- `service_order_notes` (opcional mínimo)
- RPCs/funções: `convert_accepted_quote_to_service_order` (ou serviço TS + constraints)
- Policies RLS por `company_id`
- Seed permissões `quotes.convert`, `orders.view`, `orders.manage`

### App

- Lista profissional `/quotes` (tabela + filtros + URL)
- Detalhe consolidado `/quotes/[id]`
- Máquina de status cotação (`Lib/quotes/statusMachine.ts`)
- Conversão API `POST /api/quotes/[id]/convert`
- Lista/detalhe `/orders`, `/orders/[id]`
- Nav Operacional → Ordens de Serviço
- i18n PT/EN/ES dicts de domínio
- Integração agenda: `agenda_events.service_order_id`
- Scripts QA `scripts/dev/test-quote-to-order-*.mjs`

---

## 5. Idempotência e concorrência

1. Unique `(company_id, quote_version_id)` em `service_orders`.  
2. Conversão sob permissão `quotes.convert` + membership.  
3. Retry devolve a mesma OS.  
4. Numeração via `get_next_document_number(..., 'service_order')`.  
5. Snapshot comercial **não** recalcula catálogo.

---

## 6. Segurança

- `requireApiPermission` em todas as APIs novas.  
- `company_id` do contexto servidor — nunca do body do cliente.  
- RLS em todas as tabelas novas.  
- Token público de proposta não concede backoffice.  
- Cross-tenant: invisível / 404 / 403.

---

## 7. Relação com Logistics (somente referência)

| Padrão | Classificação |
|--------|----------------|
| Lista filtros / row actions | adaptar |
| Proposta token/RPC | reutilizar (já no Catering) |
| Sequence documental | reutilizar |
| OS = mesma linha da proposta | **não usar** |
| Frota / frete / motorista | **não usar** |

---

## 8. Gates

Ver `docs/qa/quotes-orders-test-plan.md` (Gate 0…6). Baseline: `docs/qa/quotes-orders-baseline-before.md`.
