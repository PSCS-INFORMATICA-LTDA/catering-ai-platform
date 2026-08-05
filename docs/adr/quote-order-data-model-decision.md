# ADR — Modelo de dados Cotação → Ordem de Serviço

**Status:** Aceito  
**Data:** 2026-08-05  
**Branch:** `feat/quotes-orders-operational-foundation-dev`  
**Contexto:** Consolidar Cotações e fundação Quote → Order/OS (sem Financeiro/DRE).

---

## Decisão 1 — Nome da entidade operacional

**Escolhido:** `service_orders`

| Candidato | Motivo de rejeição / aceite |
|-----------|-----------------------------|
| `orders` | Ambíguo com pedido de compra / futuro AR; helper existe mas fase financeira está fora de escopo |
| `event_orders` | Bom semanticamente, mas diverge do prefixo `SO` já previsto em `document_sequences` |
| `work_orders` | Tom industrial; menos natural em PT “Ordem de Serviço” |
| **`service_orders`** | **Aceito** — UI PT/EN/ES (“Ordem de Serviço” / “Service Order” / “Orden de Servicio”); RPC `get_next_document_number(..., 'service_order')` já existe; alinhado ao doc legado `quote-to-order.md` na camada operacional |

**Implicação desta fase:** não criar tabela `orders` intermediária. A Ordem de Serviço é o documento operacional criado a partir da versão aceita da cotação. A tabela `orders` fica reservada para Contas a Receber (fora de escopo).

---

## Decisão 2 — Fonte da verdade

| Conceito | Fonte da verdade | Snapshot |
|----------|------------------|----------|
| Negociação comercial | `quotes` + seleções/adicionais | Versão em `quote_versions` |
| Ocorrência do catering | `events` (já ligado a `quotes.event_id`) | Campos de local/data também no snapshot da versão e da OS |
| Execução operacional | `service_orders` | `commercial_snapshot` JSONB imutável + totais denormalizados |
| Agenda de equipe | `agenda_events` (existente) | Vinculada por `quote_id` / `service_order_id` |

Fluxo:

```
Cliente → Evento → Cotação → quote_versions → Proposta pública → Aceite
  → (confirmação interna) → service_orders → Agenda/Equipe/Checklist → Conclusão
```

---

## Decisão 3 — Versões

`quote_versions` **não existia**. Coluna `quotes.version` (integer) era apenas contador.

**Criar** `quote_versions` com:
- vínculo `quote_id`, `company_id`, `version_number`
- totais e moeda/idioma
- `commercial_snapshot` JSONB versionado (`schema_version`)
- flags `is_current`, `accepted_at` (uma versão aceita por cotação, via partial unique)

Alterações comerciais relevantes geram nova versão. Notas internas / atribuições internas **não** geram versão.

---

## Decisão 4 — Aceite → conversão

- Aceite público (já existente) registra aprovação na cotação/`quote_versions`.
- **Conversão para OS é confirmada por usuário autorizado** (não automática), para revisão operacional.
- Conversão **idempotente**: unique `(company_id, quote_version_id)` em `service_orders`.

---

## Decisão 5 — Numeração

Usar `get_next_document_number(company_id, 'service_order')` / `getNextServiceOrderNumber` — concorrência segura via `document_sequences`. Prefixo genérico `SO` (não hardcodar CDL).

---

## Decisão 6 — Auditoria

Reutilizar `audit_logs` quando possível; complementar com `service_order_status_history` para máquina de estados da OS. Não criar segundo RBAC.

---

## Decisão 7 — Permissões novas

Adicionar ao catálogo (fallback + seed):

- `quotes.convert`
- `orders.view` / `orders.manage` (chaves estáveis; UI “Ordens de Serviço”)

Mapear: owner/admin/manager/sales → convert+manage conforme papel; operator → view+manage operacional sem convert; viewer → view.

---

## Consequências

- Docs antigos que falam em `orders` + `service_orders` na mesma fase ficam **parcialmente supersedidos** para esta entrega.
- Logistics OS=proposta **não** é copiado: no Catering, cotação e OS são documentos distintos.
