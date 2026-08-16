# Materiais da OS — Fase 1 — Resultados

**Produto:** Catering AI Platform / BBQ At Home / CDL  
**Responsável funcional:** Philippe Santana  
**Branch:** `feat/order-materials-operations-dev`  
**Baseline:** `8d07575`  
**Ambiente:** Supabase DEV `yasprgtlqclwsjcshtls`  
**Arquitetura:** B — tabela `service_order_materials` (operacional), separada de `service_order_items`.

---

## Escopo entregue

- Modelo operacional + constraints + índices  
- RLS membership + RBAC `orders.materials.view|prepare|check`  
- APIs list/create/update/separate/check/cancel  
- UI Materiais na OS (desktop tabela / mobile cards)  
- i18n PT/EN/ES  
- Auditoria operacional  
- Seed `SO-TEST-DEV-MATERIALS` + matriz QA T01–T10  

## Fora de escopo (Fase 2)

Dispatch, link público, token de retirada, retorno, sobras, estoque, movimento de estoque.

---

## Migration DEV

| Item | Valor |
|------|--------|
| Arquivo | `supabase/migrations/20260810120000_service_order_materials.sql` |
| Repair prévio | `20260807180000` marcado `applied` (já estava no DEV; discovery) |
| Dry-run pré-push | somente materials |
| Push | aplicado em DEV |
| Dry-run pós-push | `upToDate=true` |

---

## QA

| Suite | Resultado |
|-------|-----------|
| `test:dev:order-materials` | PASS (T01–T10) |
| `test:dev:order-material-preparation` | PASS |
| `test:dev:order-material-check` | PASS |
| Seed `seed:dev:order-materials` | 8 materiais |

OS demo: `SO-TEST-DEV-MATERIALS`  
URL: `/orders/f2400000-0000-4000-8000-000000000091`

---

## Regressão / Build / Deploy

| Item | Resultado |
|------|-----------|
| `qa:dev:schedule-conflict-matrix` | PASS 12/12 |
| `verify:dev:team-scale` | PASS |
| `verify:dev:functional` | PASS |
| `npm run build` | PASS |
| Push | `feat/order-materials-operations-dev` |
| Preview | https://catering-ai-platform-gprt05hit-pscs-informatica-ltda-s-projects.vercel.app |
| Alias estável | https://catering-ai-agenda-dev.vercel.app |
| Commits | `c28c493` … `21b4ece` |

## Confirmações

- DEV only  
- Production intacta  
- main / homologation não alteradas nesta fase  
- Agenda / Supplier Garnish não alterados funcionalmente  
- Estoque **não** implementado  

**STATUS:** PRONTO PARA VALIDAÇÃO DE PHILIPPE — MATERIAIS DA OS: SEPARAÇÃO E CONFERÊNCIA  

