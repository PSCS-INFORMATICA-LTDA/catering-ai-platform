# Catering AI Platform — Matriz de Maturidade V2

**Produto:** Catering AI Platform — BBQ AT HOME / CDL  
**Tipo de documento:** Diagnóstico técnico + comparação Logistics × Catering  
**Versão:** V2 (substitui V1 como matriz oficial vigente)  
**Data de corte:** 2026-08-05 (rev. Quotes/Orders foundation)  
**Base:** código em `feat/quotes-orders-operational-foundation-dev` (parte de `feat/auth-users-rbac-catering-dev` @ `e115c0d`) + referência `D:\PSCS\Projetos\grx-management`  
**Antecessora:** `docs/CATERING_AI_MATRIZ_MATURIDADE_V1.md` (histórico)  
**Ambiente desta revisão:** Supabase DEV `yasprgtlqclwsjcshtls` — **IMPLEMENTADO EM DEV / PRONTO PARA VALIDAÇÃO** (não Produção)

**Propósito deste V2:** orientar as **próximas migrações** e as **otimizações de tela** do Catering, sem copiar frota/veículos/motoristas do Logistics.

---

## 1. Produto e referência

| Campo | Valor |
|-------|--------|
| Nome | Catering AI Platform |
| Marca operacional | BBQ AT HOME |
| Piloto | CDL (Orlando) |
| Stack | Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind 4, `@react-pdf/renderer` |
| Referência de maturidade | Logistics AI / GRX (`grx-management`) |
| Domínio | Catering BBQ (cotações → evento → equipe) — **não** transporte |

**Usar Logistics como referência para:** auth, usuários/RBAC, multiempresa, cadastros, agenda operacional, conversão proposta→ordem, financeiro/DRE genérico, auditoria, padrões de lista/CRUD, share público (proposta/designação).

**Não portar:** frota, veículos, motoristas, pátio, lava-rápido, infrações, despesas de veículo/motorista, senha máster.

---

## 2. Ambientes

| Ambiente | Nome Supabase | Project ref |
|----------|---------------|-------------|
| PROD | `catering-ai-platform-PROD` | `eapwtirhevxrqinytans` |
| DEV | `catering-ai-platform-DEV` | `yasprgtlqclwsjcshtls` |

**Evolução vs V1:** pasta `supabase/migrations/` **existe** e contém fundação Auth/RBAC, RLS, agenda/equipes, propostas, designação de equipe, address book (papéis em `customers`). Runtime Preview/DEV deve apontar só para DEV. Produção não é alvo de experimentação.

---

## 3. Legenda

| Status | Significado |
|--------|-------------|
| **TEM** | Fluxo funcional comprovado (rota/API/Lib + persistência). |
| **PARCIAL** | Estrutura ou fluxo incompleto; UI stub ou domínio só comercial. |
| **NÃO TEM** | Sem implementação funcional (stub “Em breve”, doc futura ou tabela órfã). |
| **N/A** | Fora de escopo do Catering (domínio frota) ou sem equivalente direto. |

---

## 4. Resumo oficial V2

### TEM

- Repositório e execução local  
- Separação Supabase PROD/DEV (disciplina operacional + migrations)  
- Autenticação (login, sessão SSR, forgot/reset, logout)  
- Usuários e acessos / RBAC por permissão  
- Pessoas (Address Book unificado: cliente / fornecedor / equipe)  
- Equipes operacionais  
- Pacotes e configuração de catálogo  
- Itens adicionais  
- Cotações (wizard, lista profissional, detalhe, edição, soft-delete, filtros)  
- Versões comerciais (`quote_versions` + snapshot) — **IMPLEMENTADO EM DEV**  
- Proposta pública tokenizada + share WA/SMS/e-mail + aceite/rejeição  
- Conversão Cotação aceita → Ordem de Serviço (`service_orders`) — **IMPLEMENTADO EM DEV**  
- Ordens de Serviço (lista/detalhe/status/checklist) — **IMPLEMENTADO EM DEV**  
- Designação de equipe (token público + templates)  
- Agenda de eventos (visão semanal + disponibilidade; vínculo OS)  
- PDF do orçamento  
- Empresa (perfil, endereço, logo)  
- Regras comerciais  

### PARCIAL

- Multiempresa / membership (wired; licença/billing e troca de tenant ainda finas)  
- Platform Admin / suporte impersonation  
- Eventos (acoplados à cotação + agenda + OS; sem estoque)  
- Traduções PT/EN/ES (domínio quotes/orders + conteúdo; chrome UI ainda majoritariamente PT)  
- Imagens e Storage (pacotes/itens; foto grill “Em breve”)  
- WhatsApp / SMS / e-mail (deep links e templates; sem API Business / SMTP)  
- Segurança e RLS (inclui novas tabelas OS; revisão contínua)  
- Portal do cliente (`/proposta` live; `/quote-request` stub)  
- Auditoria (histórico de status OS + eventos sensíveis; UI audit completa pendente)  
- Integrações (Google Calendar target sem sync completo)  

### NÃO TEM

- Dashboard gerencial com KPIs (`/dashboard` futuro)  
- DRE  
- Financeiro (AP/AR/contas) — tabela `orders` comercial/financeiro reservada para fase futura  
- Estoque e insumos  
- Licença / mensalidade  
- Recursos de IA no produto  

**Contagem V2 (rev.):** TEM ~20 · PARCIAL ~10 · NÃO TEM 6  

**Delta desta entrega:** Cotações consolidadas em lista; `quote_versions`; aceite→conversão idempotente; `service_orders` + checklist/status; nav Ordens de Serviço. Dashboard/DRE/Financeiro permanecem fora de escopo.

---

## 5. Matriz comparativa Logistics × Catering

| # | Módulo / capacidade | Logistics (GRX) | Catering | Gap / nota de migração ou UX |
|---|---------------------|-----------------|----------|------------------------------|
| 1 | Stack Next + Supabase | TEM | TEM | Paridade |
| 2 | Login / sessão SSR / logout | TEM | TEM | Catering: `proxy` + `@supabase/ssr` |
| 3 | Forgot / reset password | TEM | TEM | `/auth/*` |
| 4 | Meu perfil / trocar senha | PARCIAL | TEM | Catering à frente em `/profile` |
| 5 | Usuários e convite | TEM | TEM | `/users` + APIs |
| 6 | RBAC (telas ou permissões) | TEM (`partner_screen_permissions`) | TEM (permission keys) | Modelos diferentes; ambos enforçam |
| 7 | Gate de rotas backoffice | TEM | TEM | Públicos: proposta, designação, quote-request |
| 8 | Multiempresa / membership | TEM | PARCIAL | Membership ok; licença/billing fraco |
| 9 | Platform Admin / suporte | PARCIAL | PARCIAL→TEM | APIs support start/end |
| 10 | Dashboard KPIs | TEM `/dashboard` | NÃO TEM | Landing `/` — **prioridade produto** |
| 11 | Agenda operacional | TEM (frota) | TEM (eventos BBQ) | *Nome diferente*; não copiar frota |
| 12 | Ordem de serviço / Order | TEM (núcleo) | TEM (DEV) | `service_orders` + convert; **PRONTO PARA VALIDAÇÃO** |
| 13 | Cotação / proposta comercial | TEM (via OS) | TEM (quotes) | Catering mais forte como produto de cotação |
| 14 | Proposta pública `/proposta/[token]` | TEM | TEM | Aceite/resposta |
| 15 | Share WA / SMS / e-mail | TEM | TEM | Painéis + templates |
| 16 | Designação (motorista ↔ equipe) | TEM motorista | TEM equipe | `/designacao-equipe/[token]` |
| 17 | Templates WhatsApp | TEM | TEM | `Lib/whatsappMessageTemplates.ts` |
| 18 | Cadastro pessoas | PARCIAL (clientes + fornecedores) | TEM (Pessoas unificado) | Flags `is_customer` / `is_supplier` / `is_team` |
| 19 | Equipes operacionais | N/A (motoristas) | TEM `/teams` | Domínio Catering |
| 20 | Catálogo / pacotes BBQ | N/A (tarifas) | TEM | Força do produto |
| 21 | Itens adicionais | N/A | TEM | |
| 22 | Regras comerciais | PARCIAL (frete/pátio) | TEM | Domínio diferente |
| 23 | Empresa + logo | TEM | TEM | `/settings/company` |
| 24 | Integrações / Calendar | TEM UI | PARCIAL | Sync incompleto |
| 25 | Licença / mensalidade | TEM | NÃO TEM | Baixa prioridade piloto |
| 26 | Senha máster | TEM | NÃO TEM | **Não portar** |
| 27 | Histórico exclusões / audit UI | TEM | PARCIAL | Soft-delete quotes; sem UI audit |
| 28 | DRE (lançamentos/aprovações) | TEM | NÃO TEM | Nav “Em breve” — ledger genérico depois |
| 29 | Financeiro AP / contas | TEM | NÃO TEM | Após Order + depósitos |
| 30 | Contas DRE / sócios / participações | TEM | NÃO TEM | Avaliar só se CDL pedir |
| 31 | Frota / veículos / pátio / infrações | TEM | N/A | Fora de escopo |
| 32 | Estoque / insumos | leve/N/A | NÃO TEM | Pós-Order |
| 33 | PDF comercial | TEM | TEM | Quote PDF |
| 34 | UX lista CRUD (desktop table) | TEM (`CrudPage`) | TEM (DEV) | Pessoas + Cotações + Ordens em lista |
| 35 | Portal cliente self-service | PARCIAL | PARCIAL | Proposta live; request stub |
| 36 | i18n PT/EN/ES | NÃO TEM (UI) | PARCIAL | Cotação + mensagens; UI PT |
| 37 | Totais / % reserva na proposta | PARCIAL | PARCIAL | Comercial sim; AR não |

---

## 6. Mapa de telas Catering (atual)

| Grupo | Rota | Status UX | Observação vs Logistics |
|-------|------|-----------|-------------------------|
| — | `/` | Landing | Sem KPIs (`/dashboard` Logistics) |
| Operacional | `/agenda` | TEM | Espelho conceitual da agenda (eventos, não frota) |
| Operacional | `/quotes` | TEM (cards) | Otimizar → lista/tabela desktop |
| Operacional | `/quotes/new` | TEM wizard | Forte |
| Operacional | `/quotes/[id]` | TEM + share/designação | Paridade proposta/designação Logistics |
| Cadastros | `/teams` | TEM lista | Sem frota |
| Cadastros | `/customers` (Pessoas) | TEM lista + coluna Papel | Address book unificado (à frente) |
| Cadastros | `/packages`, `/additional-items`, `/packages/images` | TEM | Catálogo BBQ |
| DRE | stub | NÃO TEM | Espelhar estrutura genérica depois |
| Financeiro | stub | NÃO TEM | Idem |
| Parâmetros | `/commercial-rules` | TEM | |
| Config | `/settings/company`, `/users`, `/profile` | TEM | |
| Público | `/proposta/[token]`, `/designacao-equipe/[token]` | TEM | Paridade |
| Público | `/login`, `/auth/*` | TEM | |
| Público | `/quote-request` | Stub | Portal incompleto |

---

## 7. Detalhamento dos módulos que mudaram desde a V1

### 7.1 Autenticação — TEM (era NÃO TEM)

Login e-mail/senha, sessão cookie SSR, forgot/reset, logout, gate de rotas. Evidências: `app/login`, `app/auth/*`, `proxy.ts` / middleware Supabase, APIs `/api/auth/*`.

### 7.2 Usuários e RBAC — TEM (era PARCIAL)

Tela `/users`, invite, papéis, `Lib/auth/permissions.ts`, `requireApiPermission`. Diferente do modelo screen-by-partner do Logistics, mas funcional.

### 7.3 Pessoas (Address Book) — TEM (era “Clientes”)

Cadastro único com papéis Cliente / Fornecedor / Equipe; lista com coluna **Papel**, ações Editar / Analisar / Excluir. Migration `20260804200000_people_registry_roles.sql`.

### 7.4 Equipes — TEM (novo)

`/teams`, `operational_teams`, vínculo a pessoa de contato, idioma preferido.

### 7.5 Agenda de eventos — TEM (era NÃO TEM)

`/agenda`, eventos semanais, regra 1 equipe/dia, share de disponibilidade. Domínio BBQ — não agenda de frota.

### 7.6 Proposta pública + share — TEM (era gap)

Token, painel WA/SMS/e-mail, templates multilíngues, `/proposta/[token]`.

### 7.7 Designação de equipe — TEM (novo)

Apresentação, designação, token `/designacao-equipe/[token]` — espelho da designação de motorista do Logistics sem domínio de frota.

### 7.8 WhatsApp — PARCIAL→alto (era FAB genérico)

FAB flutuante removido do layout; share contextual na cotação/designação. Ainda sem WhatsApp Business API.

### 7.9 Ordem de serviço — NÃO TEM (inalterado)

Maior gap para fechar o ciclo operacional cotação → execução.

### 7.10 DRE / Financeiro / Dashboard — NÃO TEM (inalterado)

Nav com “Em breve”. Totais comerciais existem na cotação.

---

## 8. Próximas migrações recomendadas (ordem)

Ordem oficial V2 (execução sob autorização explícita; DEV only até liberar Preview/PROD):

| Ordem | Entrega | Tipo | Motivo |
|------:|---------|------|--------|
| 1 | **Quote → Order** (`orders` / status operacional) | Migration + API + UI | Fecha espinha Logistics (OS) no domínio catering |
| 2 | **Service / Event Order** ligada à agenda | Migration + UI | Agenda deixa de ser só “visão” e passa a executar |
| 3 | **Dashboard gerencial** (KPIs pipeline/conversão) | UI + queries | Paridade `/dashboard` Logistics |
| 4 | **Auditoria** (`audit_logs` + UI histórico) | Migration + writers | Quem alterou/excluiu |
| 5 | **Contas a receber (depósito/reserva)** | Migration + UI Financeiro mínimo | Antes do DRE completo |
| 6 | **DRE genérico** (lançamentos/aprovações sem frota) | Módulo | Nav já reserva espaço |
| 7 | Hardening RLS residual + testes de permissão | Segurança | Contínuo |
| 8 | Integração Calendar (se CDL priorizar) | Integração | Baixa vs Order |
| 9 | Licença/mensalidade | Config | Só se multi-tenant comercial |
| — | Frota / senha máster | — | **Não migrar** |

---

## 9. Otimizações de tela recomendadas (sem migration)

Prioridade de UX alinhada ao padrão Logistics (`CrudPage` / tabelas desktop):

| Prioridade | Tela | Ação sugerida |
|-----------:|------|----------------|
| P1 | `/quotes` | Trocar grid de cards por **lista/tabela** (desktop) com expandir “Analisar”; manter cards só mobile se necessário |
| P2 | `/quotes/[id]` | Consolidar blocos share/designação (menos scroll); ações claras pós-aceite → Order (quando existir) |
| P3 | `/agenda` | Alinhar densidade visual e filtros ao padrão Logistics (sem widgets de frota) |
| P4 | `/teams` | Garantir coluna de contato/idioma/papel da pessoa vinculada (paridade Address Book) |
| P5 | `/` | Substituir landing por **dashboard** ou redirect autenticado para KPIs |
| P6 | Nav DRE/Financeiro | Manter “Em breve” até migrations 5–6; não inventar telas vazias |
| P7 | `/packages` + itens | Revisar lista vs cards para consistência com Pessoas |
| P8 | Portal `/quote-request` | Só após Order/proposta estáveis |

**Já otimizado (referência):** Pessoas em lista com coluna Papel; remoção de botões de cotação no cadastro de pessoas; remoção FAB WhatsApp global e toolbar Vercel no Preview (acesso externo).

---

## 10. Riscos vigentes

1. **Ausência de Order/OS** — cotação não vira operação formal.  
2. **Sem dashboard** — gestão às cegas além da lista de cotações.  
3. **DRE/Financeiro inexistentes** — dinheiro só como totais da proposta.  
4. **Auditoria incompleta** — soft-delete sem trilha “quem/quando”.  
5. **RLS/grants** — evoluiu desde V1; manter revisão em toda migration.  
6. **Mistura DEV/PROD** — disciplina de env e deploy Preview continua crítica.  
7. **Preview público** — autenticação Vercel do Preview pode ser desligada para testes externos; o login do **app** continua obrigatório nas rotas protegidas.

---

## 11. Controles deste documento

- Documento de planejamento/diagnóstico; não altera código por si.  
- Não contém segredos.  
- V1 permanece como histórico; **V2 é a matriz oficial vigente**.  
- Próxima revisão material → V3 (não sobrescrever silenciosamente decisões).

---

*Fim da Matriz de Maturidade V2.*
