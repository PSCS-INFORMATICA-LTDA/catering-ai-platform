# Spec funcional — Cotação → Ordem de Serviço

**Idioma:** PT (rótulos UI também EN/ES)  
**ADR:** `docs/adr/quote-order-data-model-decision.md`

---

## A. Cotação

Documento comercial da proposta de catering.

| Campo / conceito | Descrição |
|------------------|-----------|
| Número | `quote_number` via sequence `quote` |
| Empresa | `company_id` (contexto auth) |
| Cliente | `customer_id` → Pessoas |
| Evento | `event_id` → `events` |
| Responsável | usuário criador / vendedor quando disponível |
| Idioma | `language` PT/EN/ES |
| Moeda | USD no piloto (schema atual) |
| Convidados / local / pacote / adicionais / opções | via event + selections |
| Totais | `calculateQuoteTotals` — **não alterar fórmula** sem doc; fixture **2830** |
| Validade | quando existir no schema; senão derivada de envio |
| Versão | `quote_versions.version_number` + `quotes.version` espelho |
| Status técnico | ver máquina §E |
| Share / aceite | `proposal_*` existentes |
| Conversão | após aceite + permissão |

---

## B. Versão

Nova versão quando mudar valor comercial material:

- pacote, adicionais, quantidades, convidados billable, desconto/taxa/mileage, data/local do evento que conste na proposta, idioma da proposta, total.

**Não** gera versão: nota interna, designação de equipe, presentation time, follow-up count, soft-delete.

Aceite amarra **uma** versão (`accepted_at` / partial unique).

---

## C. Aceite / rejeição

Preservar fluxo público `/proposta/[token]`.

| Regra | Valor |
|-------|--------|
| Quem | Cliente via token; staff on-behalf se já existir |
| Versão | versão corrente enviada / aceita |
| Idempotência | segunda accept na mesma pending → mesma resposta |
| Revogação | não automática; nova negociação = nova versão |
| Conversão | **manual** por usuário com `quotes.convert` |
| Backoffice | aceite não autentica usuário do sistema |

Campos já existentes: `proposal_response`, `proposal_accepted_at`, `proposal_rejected_at`. Estender versão aceita em `quote_versions`.

---

## D. Ordem de Serviço (`service_orders`)

Objetivo: execução operacional do evento aprovado.

UI: PT Ordem de Serviço · EN Service Order · ES Orden de Servicio.

Campos mínimos: número SO, quote_id, quote_version_id, event_id, customer_id, status operacional, schedule, venue/address snapshot, guest_count, currency, totais comerciais, commercial_snapshot, notes, cancel/complete metadata.

Sem campos de recebimento/pagamento nesta fase.

---

## E. Status da cotação (máquina)

Compatibilidade: mapear `approved` ↔ aceito; `cancelled` ↔ rejeitado/cancelado.

Estados canônicos (chave técnica):

`draft` → `ready_for_review` → `sent` → `viewed` → `accepted` → `converted`  
paralelos: `rejected`, `expired`, `cancelled`, `archived`

Aliases legados aceitos na leitura: `approved`≡`accepted`, `canceled`≡`cancelled`.

Transições inválidas → 400 com motivo.

---

## F. Status da OS

`planned` → `confirmed` → `preparing` → `team_assigned` → `ready` → `in_progress` → `completed`  
`cancelled` com motivo obrigatório (sem hard delete).

---

## G. Regras de conversão

1. Cotação aceita (`proposal_response=accepted` ou status accepted/approved).  
2. Versão aceita existe e pertence à cotação/empresa.  
3. Idempotente.  
4. Uma OS ativa por `quote_version_id`.  
5. Snapshot imutável.  
6. Catálogo futuro não altera OS.  
7. Cotação futura não altera OS.  
8. Nova negociação → nova versão + decisão.  
9. Exceção manual: permissão + motivo.  
10. Auditoria obrigatória.

---

## H. Checklist

Itens por OS: título, categoria, obrigatório, ordem, status, completed_by/at. Categorias: comercial, preparação, equipe, equipamentos, alimentos, logística_evento, montagem, execução, desmontagem, pós-evento.

---

## I. Agenda / Equipe

Reutilizar `agenda_events` + `operational_teams`. OS referencia evento e, quando designada, alinha `service_order_id` no agenda event. Conflito de equipe no mesmo dia: alerta (regra unique já existente no agenda).
