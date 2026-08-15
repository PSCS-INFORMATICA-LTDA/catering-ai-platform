<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Codex Cloud development instructions

**Repositório:** Catering AI Platform / PSCS (`PSCS-INFORMATICA-LTDA/catering-ai-platform`)

**Ambiente padrão:** DEV
**Supabase DEV:** `yasprgtlqclwsjcshtls`
**Branch funcional atual:** `feat/quote-wizard-v2-dev`

Fonte compartilhada: GitHub + ambiente Codex Cloud + Supabase DEV + Vercel Preview/DEV.

### Regras

- Nunca usar PROD por padrão.
- Nunca executar `vercel --prod`.
- Nunca executar migration em PROD.
- Nunca usar `db reset` / `truncate`.
- Supabase padrão = DEV (`yasprgtlqclwsjcshtls`).
- Nunca iniciar trabalho funcional pela `main`; ela está atrás da baseline DEV.
- Antes de alterar código: confirmar que a tarefa parte de `origin/feat/quote-wizard-v2-dev` ou de uma branch sucessora explicitamente indicada.
- Criar uma branch própria por tarefa; não desenvolver diretamente na branch-base.
- Antes de finalizar: testes + build.
- DEV autorizado: commit + push + PR em Draft + Preview deploy automático.
- PROD exige aprovação explícita de Philippe.
- Não usar force push automaticamente.
- Não commitar secrets (`.env*`, tokens, service role).
- Não modificar layout fora do escopo solicitado.
- Mudança estrutural/layout relevante exige aprovação de Philippe antes.
- Não fazer merge automaticamente. Philippe aprova o Preview antes do merge.

### Colaboração

- Quem terminar: commit + push + working tree clean.
- Quem começar: sincroniza Git antes de editar.
- Se houver alterações concorrentes ou base divergente, parar e reconciliar antes de continuar.

### Comandos (Codex Cloud/Linux e Windows)

Os scripts do `package.json` são portáveis (`node` / `npm run`).

| Contexto | Install | Build | Preview DEV |
|---|---|---|---|
| Codex Cloud / Linux | `npm ci` | `npm run build` | automático pelo PR/GitHub |
| Windows local | `npm.cmd ci` | `npm.cmd run build` | automático pelo PR/GitHub |

Não colocar servidor de longa duração no setup do Cloud.

### Variáveis e credenciais

Configuração do Codex: `docs/CODEX_CLOUD.md`.
Nunca gravar valores no Git ou em chat.

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` pertencem ao ambiente DEV e são necessários para build e rotas autenticadas.
- Não disponibilizar `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` ou `VERCEL_TOKEN` ao agente Codex.
- Operações privilegiadas de Supabase e Vercel devem usar integrações autorizadas fora do runtime de código.

### Comportamento sem credenciais Supabase (não óbvio)

As variáveis públicas do Supabase DEV (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) precisam estar disponíveis no ambiente Cloud ou em `.env.local`. Sem elas:

- `npm run dev` sobe normalmente; `/` e `/login` renderizam (o middleware ignora auth quando faltam as env vars), mas qualquer rota com dados do Supabase (ex.: `/quotes`) retorna **500** (`Lib/supabase.ts` cria o client no load do módulo e lança `supabaseUrl is required`).
- `npm run build` **falha** em "Collecting page data" (ex.: `/api/auth/logout`) pelo mesmo motivo. Ou seja, build e qualquer fluxo autenticado (login, criar cotação) exigem as credenciais DEV presentes.
- Fluxo autenticado E2E usa o projeto **hosted DEV** (`yasprgtlqclwsjcshtls`), que já tem usuários/tenant/catálogo. Não há `supabase/seed.sql`, então um stack Supabase local sobe vazio (sem tenant/login utilizável).
