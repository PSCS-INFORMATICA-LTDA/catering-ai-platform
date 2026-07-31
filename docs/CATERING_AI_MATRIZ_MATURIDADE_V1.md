# Catering AI Platform — Matriz de Maturidade V1

**Produto:** Catering AI Platform — BBQ AT HOME / CDL
**Tipo de documento:** Diagnóstico técnico consolidado (somente leitura)
**Versão:** V1
**Base:** Auditoria de código e separação de ambientes concluída nesta conversa
**Escopo:** Registro oficial do que TEM / PARCIAL / NÃO TEM — sem plano de implementação executável neste arquivo

---

## 1. Produto

| Campo | Valor |
|-------|--------|
| Nome | Catering AI Platform |
| Marca operacional | BBQ AT HOME |
| Piloto | CDL (Orlando) |
| Stack observada | Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind 4, `@react-pdf/renderer` |
| Propósito atual | Backoffice comercial de cotações/catering BBQ com catálogo configurável |

---

## 2. Referência de maturidade

**Referência:** Logistics AI / GRX (`logistics-ai-erp` / `grx-management`)

Usar Logistics **somente** como referência de maturidade para:

- autenticação;
- usuários e perfis;
- multiempresa;
- cadastros;
- ordem de serviço;
- agenda;
- financeiro;
- segurança;
- auditoria.

**Não copiar** conceitos de frota, veículos, motoristas ou transporte.

---

## 3. Ambientes conhecidos

| Ambiente | Nome Supabase | Project ref |
|----------|---------------|-------------|
| PROD | `catering-ai-platform-PROD` | `eapwtirhevxrqinytans` |
| DEV | `catering-ai-platform-DEV` | `yasprgtlqclwsjcshtls` |

**Observações de separação (diagnóstico de ambientes):**

- CLI local estava linkado ao **DEV** (`supabase/.temp`, gitignored).
- Dump estrutural versionado: `supabase/schema/prod_structure.sql` (origem PROD).
- Pasta `supabase/migrations/` **ausente**.
- App não hardcoda project refs; runtime depende de variáveis de ambiente.
- `.env.local` existe no disco e está protegido por `.gitignore` (`.env*`) — conteúdo não inspecionado neste documento.
- Projeto Vercel local (`.vercel/project.json`, gitignored): `catering-ai-platform`.

---

## 4. Legenda

| Status | Significado |
|--------|-------------|
| **TEM** | Fluxo funcional comprovado no código (rota/API/Lib + persistência). |
| **PARCIAL** | Estrutura, interface, tabela ou fluxo incompleto; não basta menção em README/docs. |
| **NÃO TEM** | Sem implementação funcional comprovada (planejado, stub, tabela órfã ou comentário futuro não contam). |

---

## 5. Matriz oficial confirmada

### TEM

- Repositório e execução local
- Clientes e contatos
- Pacotes
- Itens adicionais
- Orçamentos
- PDF do orçamento

### PARCIAL

- Separação Supabase PROD/DEV
- Usuários e perfis
- Multiempresa
- Eventos
- Traduções PT/EN/ES
- Imagens e Storage
- WhatsApp e e-mail
- Segurança e RLS

### NÃO TEM

- Autenticação
- Ordem de serviço
- Agenda operacional
- Estoque e insumos
- Financeiro
- Dashboard gerencial
- Auditoria e histórico
- Portal do cliente e recursos de IA

**Contagem V1:** TEM 6 · PARCIAL 8 · NÃO TEM 8

> Nota de consolidação: a auditoria detalhada elevou Clientes, Pacotes, Orçamentos e PDF para **TEM**, e rebaixou Autenticação para **NÃO TEM**. A matriz desta seção é a **oficial V1** a partir desta conversa.

---

## 6. Detalhamento por módulo

### 6.1 Repositório e execução local — TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | TEM |
| Evidências técnicas | `package.json` (Next 16, React 19, `@supabase/supabase-js`, `@react-pdf/renderer`, CLI `supabase`); scripts `dev`/`build`/`start`; estrutura `app/`, `components/`, `Lib/`, `scripts/sql/`, `docs/architecture/` |
| O que funciona | Execução local via `npm run dev`; build Next configurado |
| O que está incompleto | README de produto genérico; `prompts/Master/MASTER_PROMPT_PSCS.md` ausente no workspace auditado |
| Gap vs Logistics AI | Paridade de stack; Logistics possui mais módulos de produto |
| Dependências | Node/npm; variáveis Supabase |
| Próximo passo mínimo | Manter ambiente local estável com env do ambiente pretendido (preferencialmente DEV) |
| Risco | Baixo |

---

### 6.2 Separação Supabase PROD/DEV — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | Projetos distintos (refs acima); CLI link DEV em `supabase/.temp/*`; `supabase/config.toml`; dump `supabase/schema/prod_structure.sql`; ausência de `supabase/migrations/` |
| O que funciona | Projetos PROD e DEV existem; baseline schema PROD versionado; link CLI no DEV |
| O que está incompleto | Sem pipeline dual-env formal no código; app acoplado a um único conjunto de env; estado remoto do schema DEV não revalidado nesta documentação; scripts SQL manuais em `scripts/sql/` fora do fluxo CLI |
| Gap vs Logistics AI | Logistics costuma operar com disciplina estável de ambientes |
| Dependências | Tokens CLI; senhas DB; processo de env |
| Próximo passo mínimo | Formalizar: local/DEV · Vercel Production/PROD; validar Table Editor do DEV |
| Risco | Alto (mistura de ambientes) |

---

### 6.3 Autenticação — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | Sem `middleware.ts`; sem rotas `/login` / `/auth`; sem `signIn` / `getSession` / `onAuthStateChange`; `Lib/tenant/resolveTenant.ts` documenta futuro Auth; paths de login apenas listados para ocultar UI de WhatsApp/help |
| O que funciona | Nada de sessão autenticada |
| O que está incompleto | Tabelas `app_users` / `users` no dump sem fluxo; `company_memberships` apenas em script foundation |
| Gap vs Logistics AI | Logistics: login, reset, sessão e gates |
| Dependências | Supabase Auth + memberships + RLS |
| Próximo passo mínimo | Introduzir Auth + membership por empresa (quando autorizado) |
| Risco | Crítico |

---

### 6.4 Usuários e perfis — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | `app_users`, `app_roles` no dump; roles em `Lib/tenant/types.ts`; `getActiveRoleFromEnv()`; sem UI de gestão de usuários |
| O que funciona | Role via env no piloto CDL |
| O que está incompleto | Sem CRUD de usuários, sem vínculo Auth, sem screen gates reais |
| Gap vs Logistics AI | Admin/Operacional, máster, gestão de usuários |
| Dependências | Autenticação |
| Próximo passo mínimo | Membership + tela mínima de usuários |
| Risco | Alto |

---

### 6.5 Multiempresa — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | `Lib/tenant/resolveTenant.ts`, `TenantProvider`, `TenantContextBar`, `/api/tenant/context`, `docs/architecture/multi-tenant.md`, filtro `company_id` em Lib de domínio; tabelas `franchise_groups` / `companies` / `branches` / `subscriptions` |
| O que funciona | Escopo por `company_id` (env/default CDL); barra de tenant/branch na UI |
| O que está incompleto | Sem Auth/membership; código consulta `feature_flags` vs dump com `company_features`; branch não obrigatória; billing Stripe ausente |
| Gap vs Logistics AI | Multiempresa madura + RLS + licença |
| Dependências | Auth + RLS reais |
| Próximo passo mínimo | Alinhar flags + RLS por `company_id` |
| Risco | Alto |

---

### 6.6 Clientes e contatos — TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | TEM |
| Evidências técnicas | `/customers`, `CustomersDashboard`; APIs `/api/customers`, `[id]`, `lookup-by-phone`, `resolve-by-phone`, `find-or-create`; `Lib/fetchCustomers.ts`, `findOrCreateCustomerByPhone.ts`; tabela `customers`; view `vw_customer_display` |
| O que funciona | CRUD, telefone normalizado, AB number, e-mail como campo de cadastro |
| O que está incompleto | Sem entidade “contatos” separada; sem envio de e-mail transacional |
| Gap vs Logistics AI | Logistics: clientes + fornecedores e regras cadastrais mais rígidas |
| Dependências | `company_id` |
| Próximo passo mínimo | Manter fluxo; evoluir comunicação depois |
| Risco | Baixo |

---

### 6.7 Pacotes — TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | TEM |
| Evidências técnicas | `/packages`, `PackagesDashboard`, `PackageConfigEditor`; APIs de packages/items/sides/option-groups; `Lib/writePackageConfig.ts`, `fetchPackages.ts`, `packageConfiguration.ts` |
| O que funciona | CRUD de pacotes, itens fixos, sides, option groups/choices, associação a imagens |
| O que está incompleto | Tabelas legado pouco usadas (`package_categories`, etc.) |
| Gap vs Logistics AI | Domínio diferente (tarifas vs pacotes BBQ); catálogo BBQ é forte |
| Dependências | `catalog_items`, Storage |
| Próximo passo mínimo | Hardening e limpeza de legado |
| Risco | Baixo |

---

### 6.8 Itens adicionais — TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | TEM |
| Evidências técnicas | `/additional-items`, `AdditionalItemsDashboard`; `/api/additional-items`; `Lib/fetchCatalogItems.ts` → `catalog_items`; flags `can_be_*`; upload de imagem |
| O que funciona | Catálogo no backoffice e uso no wizard de cotação |
| O que está incompleto | Flag `inventory_enabled` sem módulo de estoque |
| Gap vs Logistics AI | N/A direto |
| Dependências | Storage; escopo company |
| Próximo passo mínimo | — |
| Risco | Baixo |

---

### 6.9 Orçamentos — TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | TEM |
| Evidências técnicas | `/quotes`, `/quotes/new` (`QuoteWizard`), `/quotes/[id]`, `/quotes/[id]/edit`; APIs quotes; `Lib/createQuote.ts`, `updateQuote.ts`, `fetchQuoteList.ts`, `calculateQuoteTotals.ts`; views `quote_list_view` / `quote_detail_view` |
| O que funciona | Wizard 8 passos, listagem, edição, soft-delete, totais, snapshot |
| O que está incompleto | Sem aprovação/pagamento formal; portal público stub; máquina de status avançada limitada |
| Gap vs Logistics AI | Proposta pública + conversão em OS |
| Dependências | customers, events, packages, catalog |
| Próximo passo mínimo | Manter; depois quote → order |
| Risco | Médio (depende de RLS aberta) |

---

### 6.10 Eventos — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | Tabela `events`; `Lib/createQuote.ts` / `updateQuote.ts`; `Lib/eventsTableSchema.ts`; Google Places em `AddressAutocompleteFields.tsx` |
| O que funciona | Evento como dependência da cotação (local, data, guests, campos de grill) |
| O que está incompleto | Sem módulo Eventos standalone; sem agenda; foto da churrasqueira “Em breve” |
| Gap vs Logistics AI | Agenda / OS operacional |
| Dependências | quotes |
| Próximo passo mínimo | Modelo de evento operacional pós-order |
| Risco | Médio |

---

### 6.11 Ordem de serviço — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | `docs/architecture/quote-to-order.md` (fase futura); helpers `getNextOrderNumber` / `getNextServiceOrderNumber` em `Lib/getNextDocumentNumber.ts`; sem tabelas `orders` / `service_orders` no dump; sem rotas |
| O que funciona | Nada |
| O que está incompleto | 100% planejado |
| Gap vs Logistics AI | OS é núcleo operacional do Logistics |
| Dependências | Quote estável + auth + numeração |
| Próximo passo mínimo | Criar `orders` + `service_orders` quando autorizado |
| Risco | Alto (gap de produto) |

---

### 6.12 Agenda operacional — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | `Lib/tenant/calendar.ts` (`resolveCalendarTarget` apenas); campos Google Calendar em types; sem sync; sem rota de agenda |
| O que funciona | Resolução de calendar target em memória — sem integração |
| O que está incompleto | Sync Google não wired |
| Gap vs Logistics AI | Agenda operacional |
| Dependências | OS/eventos + OAuth Google (se aplicável) |
| Próximo passo mínimo | Agenda interna mínima por data de evento/pedido |
| Risco | Alto |

---

### 6.13 Estoque e insumos — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | UI “Inventário em breve” em `BackofficeSectionPrimitives.tsx`; flag `inventory_enabled`; `inventory_reservations` só no doc futuro |
| O que funciona | Nada operacional |
| O que está incompleto | Placeholder |
| Gap vs Logistics AI | Gestão operacional de recursos (sem frota) |
| Dependências | OS |
| Próximo passo mínimo | Modelo de reserva por evento |
| Risco | Médio |

---

### 6.14 Financeiro — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | Totais em `calculateQuoteTotals`; % reserva no wizard; `payment_rules` / `subscriptions` no schema sem app financeiro; sem rotas AP/AR/DRE |
| O que funciona | Cálculo comercial da proposta |
| O que está incompleto | Sem contas, conciliação ou gateway |
| Gap vs Logistics AI | DRE, AP, aprovações |
| Dependências | Order + pagamentos |
| Próximo passo mínimo | Contas a receber de depósito/reserva |
| Risco | Alto |

---

### 6.15 Dashboard gerencial — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | `app/page.tsx` = landing com link para `/quotes`; sem KPIs/export |
| O que funciona | Atalho para cotações |
| O que está incompleto | Sem dashboard |
| Gap vs Logistics AI | Dashboard com KPIs e export |
| Dependências | Dados de quotes/orders |
| Próximo passo mínimo | KPIs: abertas, conversão, pipeline |
| Risco | Médio |

---

### 6.16 PDF do orçamento — TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | TEM |
| Evidências técnicas | `@react-pdf/renderer`; `Lib/generateQuotePdf.tsx`; `app/api/quotes/[id]/pdf/route.ts`; `QuotePdfDownload.tsx`, `QuotePdfDocument.tsx` |
| O que funciona | Geração e download de PDF da cotação |
| O que está incompleto | Logo depende de asset `public/cdl/logo.png` (`Lib/cdlLogoForPdf.ts`) |
| Gap vs Logistics AI | Paridade de documento comercial |
| Dependências | Detalhe da quote |
| Próximo passo mínimo | Garantir asset de logo no deploy |
| Risco | Baixo |

---

### 6.17 Traduções PT/EN/ES — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | `Lib/quoteTranslations.ts`, `packageCatalogVisual.ts`, campo `language` em `buildQuoteSavePayload`; shell UI majoritariamente PT (`lang="pt-BR"`) |
| O que funciona | Conteúdo de cotação/catálogo em PT/EN/ES |
| O que está incompleto | Nav/chrome sem i18n; portal público i18n só planejado |
| Gap vs Logistics AI | Logistics menos multilíngue; BBQ precisa por mercado Orlando |
| Dependências | — |
| Próximo passo mínimo | Seletor de idioma no wizard + persistência |
| Risco | Baixo |

---

### 6.18 Imagens e Storage — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | Buckets `package-images`, `additional-item-images`; `Lib/packageImageStorage.ts`, `Lib/additionalItemImageStorage.ts`; `/packages/images`; APIs `.../image` |
| O que funciona | Upload/exibição de pacotes e itens |
| O que está incompleto | Foto da churrasqueira “Em breve”; `media_assets` pouco usado |
| Gap vs Logistics AI | Menor |
| Dependências | Policies de Storage |
| Próximo passo mínimo | Upload de grill no wizard |
| Risco | Médio |

---

### 6.19 WhatsApp e e-mail — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | `FloatingWhatsAppButton` no `app/layout.tsx` (`wa.me`); `Lib/whatsappContact.ts`; e-mail apenas como campo de customer; `components/help/*` existe mas **não** montado no layout |
| O que funciona | Deep link WhatsApp com mensagem contextual por rota |
| O que está incompleto | Sem API WhatsApp Business; sem envio de e-mail; help/IA não integrado |
| Gap vs Logistics AI | Logistics usa WA em fluxos operacionais |
| Dependências | — |
| Próximo passo mínimo | Mensagem com link/PDF da cotação |
| Risco | Baixo |

---

### 6.20 Auditoria e histórico — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | Tabela `audit_logs` no dump/foundation; zero uso `from('audit_logs')` no app TS; soft-delete pontual de quotes |
| O que funciona | Soft-delete de cotação (`active=false`) |
| O que está incompleto | Sem trilha de auditoria funcional |
| Gap vs Logistics AI | Histórico/auditoria operacional |
| Dependências | Auth (atuar “quem”) |
| Próximo passo mínimo | Gravar `audit_logs` em mutações críticas |
| Risco | Alto |

---

### 6.21 Segurança e RLS — PARCIAL

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | PARCIAL |
| Evidências técnicas | RLS habilitada em tabelas no dump; policies `allow anon … USING (true)` em regras/events/itens de quote; `GRANT ALL … TO anon` em `quotes`, `customers`, `packages`, `app_users`, etc.; client browser `Lib/supabase.ts` (anon); service role apenas server via `SUPABASE_SERVICE_ROLE_KEY` (sem `NEXT_PUBLIC_`); mutações de quote via client anon |
| O que funciona | App opera porque o acesso anon está aberto |
| O que está incompleto | Isolamento real por usuário/tenant inexistente |
| Gap vs Logistics AI | RLS baseada em membership |
| Dependências | Auth |
| Próximo passo mínimo | Fechar grants/policies anon; mutações sensíveis no server |
| Risco | Crítico |

---

### 6.22 Portal do cliente e recursos de IA — NÃO TEM

| Campo | Conteúdo |
|-------|----------|
| Status confirmado | NÃO TEM |
| Evidências técnicas | `/quote-request` stub; `/customer-quote` estático educativo; help AI não montado no layout |
| O que funciona | Página educativa; placeholder do portal |
| O que está incompleto | Sem self-service; sem IA operacional |
| Gap vs Logistics AI | Proposta pública tokenizada |
| Dependências | API de quotes segura; opcional Auth pública |
| Próximo passo mínimo | Form público telefone → draft quote |
| Risco | Médio |

---

## 7. Mapa de rotas (evidência)

| Rota | Papel | Status |
|------|-------|--------|
| `/` | Landing BBQ | Ativa (mínima) |
| `/quotes` | Lista de cotações | Ativa |
| `/quotes/new` | Wizard | Ativa |
| `/quotes/[id]` | Detalhe + PDF | Ativa |
| `/quotes/[id]/edit` | Edição | Ativa |
| `/customers` | Cadastros | Ativa |
| `/packages` | Pacotes | Ativa |
| `/packages/images` | Imagens | Ativa |
| `/additional-items` | Itens | Ativa |
| `/commercial-rules` | Regras | Ativa |
| `/customer-quote` | Educativo | Ativa (estática) |
| `/quote-request` | Portal público | Stub |
| `/login`, `/auth`, … | Autenticação | Inexistentes |

**APIs observadas:** tenant, quotes (+pdf), customers (+phone helpers), packages (+config/images), additional-items (+image), commercial-rules (+seed).

---

## 8. Mapa de tabelas utilizadas pelo código

**Uso ativo:** `companies`, `branches`, `customers`, `events`, `quotes`, `quote_additional_items`, `quote_package_selections`, `quote_option_selections` (leitura), `packages`, `package_items`, `package_side_items`, `package_option_groups`, `package_option_group_items`, `catalog_items`, `catalog_item_prices` (parcial), `commercial_rules`, `document_sequences` (RPC), tentativa de `feature_flags`, views `quote_list_view`, `quote_detail_view`, `vw_customer_display`.

**No schema, sem fluxo app comprovado:** `app_users`, `app_roles`, `users`, `audit_logs`, `payment_rules`, `staff_rules`, várias tabelas legado de quote/option/template, `subscriptions` (sem billing app).

**Planejado / ausente no dump de uso app:** `orders`, `service_orders`, `inventory_reservations`, `staff_assignments`; `company_memberships` (script foundation).

---

## 9. Riscos críticos

1. **Ausência de autenticação** — backoffice sem sessão.
2. **Rotas de backoffice sem proteção** — sem middleware/gates.
3. **Grants e policies abertas para `anon`** — `GRANT ALL` e `USING (true)` em dados comerciais.
4. **Ausência de membership real** — tenant via env/default, não via usuário autenticado.
5. **Risco de mistura DEV/PROD** — CLI em DEV, dump PROD, runtime por env, Vercel como app de produção.
6. **`feature_flags` no código versus `company_features` no banco** — desalinhamento schema/código.

---

## 10. Sequência oficial de implantação

Ordem oficial V1 (registro; execução sob autorização futura):

1. Auth e memberships
2. Proteção das rotas
3. Fechamento de grants e RLS
4. Usuários e perfis
5. Disciplina DEV/PROD
6. Auditoria
7. Quote para Order
8. Service Order
9. Agenda
10. Financeiro

---

## 11. Dez primeiras entregas mínimas (registro)

1. Supabase Auth (login e-mail)
2. `company_memberships` + resolução de tenant por sessão
3. Middleware de proteção das rotas backoffice
4. Revogar `GRANT ALL` / policies abertas ao `anon` nas tabelas core
5. Mutações sensíveis só via server (JWT + RLS ou service role server-only)
6. Tela mínima de Usuários (listar/convidar role)
7. Padrão env local → DEV (sem misturar PROD)
8. `audit_logs` em create/update/delete de quotes
9. Tabela `orders` + ação “confirmar cotação → pedido”
10. Agenda simples: lista de eventos/pedidos por data

---

## 12. Correções em relação a matrizes preliminares

| Item | Preliminar (exemplo) | Oficial V1 |
|------|----------------------|------------|
| Autenticação | PARCIAL | **NÃO TEM** |
| Clientes e contatos | PARCIAL | **TEM** |
| Pacotes | PARCIAL | **TEM** |
| Orçamentos | PARCIAL | **TEM** |
| PDF do orçamento | NÃO TEM | **TEM** |

---

## 13. Controles deste documento

- Modo de origem: auditoria somente leitura + diagnóstico de ambientes.
- Não altera código, banco, Supabase, Vercel, GitHub ou `.env.local`.
- Não contém segredos (chaves/senhas).
- Próximas alterações de matriz devem gerar V2 (não sobrescrever silenciosamente o histórico de decisões).

---

*Fim da Matriz de Maturidade V1.*
