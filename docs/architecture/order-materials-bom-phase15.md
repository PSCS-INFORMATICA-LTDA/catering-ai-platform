# Materiais da OS — Fase 1.5 — BOM operacional

**Branch:** `feat/order-materials-operations-dev`  
**Ambiente:** DEV `yasprgtlqclwsjcshtls`  
**Baseline:** Fase 1 (`service_order_materials` + separação/conferência)

## Modelo

Tabela `operational_material_rules` (por `company_id`):

- `source_type`: `package` | `additional` | `rule`
- `calculation_type`: `fixed` | `per_guest` | `tier`
- `guest_basis`: `billable_guests` | `adults` | `children` | `total_guests`
- `rounding_rule`: `none` | `ceil` | `floor` | `round`
- `tier_json`: `[{ min_guests, max_guests, quantity }]`

## Consolidação

**Estratégia:** `separate_rows_per_rule` — uma linha em `service_order_materials` por regra BOM (`bom_rule_id` único por OS).  
Mesmo material (ex.: Gelo) vindo de pacote + adicional → **duas linhas**, cada uma com origem/rastreio.

## Geração

Momento: conversão Quote→OS (`convertAcceptedQuoteToServiceOrder`), após snapshot comercial.  
Idempotente: não reprocessa `bom_rule_id` já presente.  
OS já existente (`already_existed`): **não regenera**.  
Snapshot histórico: alterar BOM depois não muda OS antiga.

## UI

- Pacotes → config do pacote → **Materiais operacionais (BOM)**
- Cadastro de itens → detalhe do adicional → mesma seção
- OS → Materiais mostra **Origem: Pacote/Adicional/Manual + rótulo**

## Fora de escopo

Estoque, dispatch, token, retorno, sobras, regeneração silenciosa.
