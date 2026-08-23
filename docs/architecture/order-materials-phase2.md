# Materiais da OS — Fase 2 (saída, retorno e sobras)

**Ambiente:** DEV `yasprgtlqclwsjcshtls`  
**Branch:** `feat/order-materials-operations-dev`  
**Estoque:** NÃO implementado (sem warehouse / movements / saldo).

## Fluxo

Necessário → Separado → Conferido → Saiu → Voltou → Sobra → (opcional) Closed

## Schema

- `service_order_materials`: `dispatched_*`, `returned_*`, `leftover_quantity`, `return_notes`, `stock_posting_status`
- `service_order_material_dispatch_confirmations`: token **hash**, expiração, revogação

## Token público

- Rota: `/conferencia-saida/[token]`
- Padrão: igual confirmação de equipe (SHA-256, sem token puro em audit)
- Expiração: fim do dia do evento (UTC) + 2 dias (fallback 7 dias)
- Novo link revoga pending anterior

## RBAC

- `orders.materials.dispatch` — gerar/revogar link
- `orders.materials.return` — retorno / sobras / fechar

## Público

Zero campos financeiros no JSON/UI.

## QA

- `test:dev:order-material-dispatch`
- `test:dev:order-material-return`
- `test:dev:order-material-public-security`
- Seed: `seed:dev:order-materials-phase2`
