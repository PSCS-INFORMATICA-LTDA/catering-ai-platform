# Estoque — modelo conceitual estilo JDE / Cardex

**Ambiente:** DEV only (`yasprgtlqclwsjcshtls`)  
**Status:** direção arquitetural — **não implementar reserva / clone F4111 / P41202 nesta rodada**  
**Implementado (v1):** `docs/architecture/inventory-v1.md`  
**Branch de implementação v1:** `feat/inventory-v1-dev` (não misturar novas features nesta branch de correção)

---

## PENDENTE — MAPEAR IMAGENS JDE

Philippe enviará referências visuais de:

- Cardex / F4111
- Consulta de disponibilidade estilo P41202 / P41xxx

**Não fechar modelo de campos definitivo até essas imagens.**  
Qualquer coluna abaixo marcada como *candidato* é hipótese de mapeamento, não spec.

---

## 1. Ledger atual (v1) = Cardex conceitual

Fonte de verdade: `inventory_movements` (imutável, `quantity` **SIGNED**).  
Projeção: `inventory_balances.quantity_on_hand = SUM(movements)`.

### Campos já conhecidos (`inventory_movements`)

| Campo v1 | Papel | Analogia JDE (conceitual) |
|----------|--------|---------------------------|
| company_id | tenant | company / MCU de negócio (não copiar MCU literal) |
| catalog_item_id | item | item number |
| location_id | local | location / warehouse simplificado |
| occurred_at | data/hora | GL date / transaction datetime |
| movement_type | tipo | document type / order type (subset) |
| quantity | sinal +/− | qty (JDE costuma ter doc + qty; nós usamos sinal) |
| unit | UM | UOM — **sem conversão v1** |
| source_type / source_id | origem | documento origem (parcial) |
| service_order_id | OS | order number (operacional) |
| service_order_material_id | linha | order line (parcial) |
| idempotency_key | anti-duplicidade | — |
| notes | referência livre | remark |
| created_by / created_at | auditoria | user / audit |

Tipos v1: `initial_balance`, `event_dispatch`, `event_return`, `event_leftover_return`, `adjustment_in`, `adjustment_out`.

Locations v1: 1 default / company (`ensure_default_inventory_location` → “Main Stock”).

### Campos aguardando imagens JDE

**PENDENTE — MAPEAR IMAGENS JDE** antes de adicionar:

- document type / document number formais (além de OS)
- batch number
- from/to location (transfer)
- lot / serial
- reason code
- GL class / custo unitário / valor (financeiro — **fora de escopo explícito**)
- branch/plant vs location hierarchy
- committed / available buckets nativos F41021
- status de movimento além do tipo

Não inventar F4111 column-for-column.

---

## 2. Disponibilidade (desenho — não implementar)

Consulta futura (P41202-like, após imagens):

| Bucket | Significado | v1 hoje |
|--------|-------------|---------|
| On Hand | físico | `quantity_on_hand` |
| Committed | reservado para OS | **não existe** |
| Available | on hand − committed (− outros) | **não existe** |
| In Transit / Em evento | despachado e não retornado | inferível por movimentos `event_dispatch` sem return — **não materializado** |
| Returned pendente | retorno a tratar | **não existe** |

Drill-down desejado (quando reserva existir):

```
quantidade reservada
  → OS
  → evento / data
  → material (linha)
  → equipe
```

**Não criar stock reservation nesta rodada.**

---

## 3. Reserva por OS (futuro)

Exemplo aprovado conceitualmente:

```
Físico           20
Reservado OS A    6
Reservado OS B    4
Disponível       10
```

Precisa de entidade futura (nome a decidir após imagens), por exemplo:

- `inventory_reservations` (company, item, location, service_order_id, material_id, qty, status, dates)

Regras a decidir depois:

- momento da reserva (conversão OS? conferência? saída?)
- hard vs soft
- o que acontece no `event_dispatch` (consome reserva + baixa on-hand)
- expiração / cancelamento da OS

---

## 4. Saldo materializado + reserva

Manter decisão v1:

- `inventory_movements` = verdade
- `inventory_balances` = projeção reconciliável

Estender **conceitualmente** (não agora):

| Coluna | Fonte |
|--------|--------|
| quantity_on_hand | SUM(movements) — já existe |
| quantity_committed | SUM(reservas ativas) — futuro |
| quantity_available | on_hand − committed (e regras extras pós-imagens) |

Alternativa: **não** materializar committed no mesmo row; view `inventory_availability` juntando balances + reservations. Preferível no início (menos risco de drift). Decisão na aprovação.

Negative stock v1: **BLOCK** em `event_dispatch` / `adjustment_out`. Reserva futura deve considerar available, não só on-hand.

---

## 5. Reconciliação e imutabilidade

- Rebuild: `rebuild:dev:inventory-balances` (recalcula on_hand).
- Sem UPDATE de movimento na API normal.
- service_role bypass de RLS documentado — nunca no frontend.

---

## 6. Fora de escopo

Purchase / AP / valuation / FIFO / LIFO / transfer / multi-warehouse complexo / inventário físico / clone F4111 / clone P41202 / Production / main.

---

## 7. Próximo passo

1. Philippe envia imagens Cardex + disponibilidade.
2. Mapear campo a campo **só o que a imagem mostrar**.
3. Aprovar buckets Available/Committed.
4. Só então spec de reservation + UI consulta.
