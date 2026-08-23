# Movement codes — PENDING JDE validation

**Ambiente:** DEV only  
**Status:** **PROVISIONAL** — aguardando prints/regras Philippe (F4111, tipos de documento JDE)  
**Migration:** `20260812130000_inventory_jde_documents_kardex.sql` (seeds em `inventory_movement_types`)

---

## Regra

Os códigos abaixo foram discutidos conceitualmente e seedados como **placeholders globais** (`company_id IS NULL`).  
**Não são padrão final** até validação contra referências JDE EnterpriseOne.

Nesta entrega:

- Arquitetura suporta `movement_code` em documents e movements
- Fluxos v1 existentes (`event_dispatch`, `event_return`, …) **não são renomeados** até bridge Fase D
- Ajuste positivo/negativo, transferência e inventário físico **não implementados** como apps finais

---

## Códigos provisionais

| Code | Nome seed | Direction | Category | Uso previsto | Status |
|------|-----------|-----------|----------|--------------|--------|
| **IB** | Initial Balance | in | balance | Saldo inicial / opening | PROVISIONAL |
| **ED** | Event Dispatch | out | event | Saída para evento/OS | PROVISIONAL |
| **ER** | Event Return | in | event | Retorno do evento | PROVISIONAL |
| **LR** | Leftover Return | in | event | Sobra retornada | PROVISIONAL |
| **AI** | Adjustment In | in | adjustment | Ajuste positivo | PROVISIONAL — app futuro |
| **AO** | Adjustment Out | out | adjustment | Ajuste negativo | PROVISIONAL — app futuro |
| **TR** | Transfer | both | transfer | Transferência entre locais | PROVISIONAL — **não implementar V1** |

---

## Mapeamento v1 → JDE (planejado)

| movement_type v1 | movement_code alvo | Notas |
|------------------|-------------------|--------|
| `initial_balance` | IB | Bridge na Fase D |
| `event_dispatch` | ED | Document EVENT_DISPATCH |
| `event_return` | ER | Documento **novo**, não editar ED |
| `event_leftover_return` | LR | Documento independente |
| `adjustment_in` | AI | Pendente validação JDE |
| `adjustment_out` | AO | Pendente validação JDE |

---

## O que Philippe deve validar

1. Códigos oficiais JDE para dispatch/return/adjustment/transfer
2. Se document type e movement code são 1:1 ou N:1
3. Reason codes obrigatórios
4. Campos F4111 adicionais (batch, from/to location, GL class) — **cost/GL fora de escopo V1**
5. Nomenclatura PT/EN para UI (i18n)

---

## Ações permitidas antes da validação

- Usar códigos provisionais em seeds DEV
- Referenciar `movement_code` em schema e RPCs
- Marcar UI/docs como "PENDING PHILIPPE VALIDATION"

## Ações proibidas antes da validação

- Consolidar como padrão PSCS global
- Remover compatibilidade com tipos v1
- Implementar telas finais de ajuste/transfer/inventory count

---

## Referências internas

- `docs/architecture/inventory-jde-model.md` — modelo conceitual
- `docs/architecture/inventory-jde-foundation-v1.md` — schema Fase B
