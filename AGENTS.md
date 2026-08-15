<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

**Repositório:** Catering AI Platform / PSCS (`PSCS-INFORMATICA-LTDA/catering-ai-platform`)

**Ambiente padrão:** DEV
**Supabase DEV:** `yasprgtlqclwsjcshtls`
**Branch funcional atual:** `feat/quote-wizard-v2-dev`

Fonte compartilhada: GitHub + `.cursor/environment.json` + secrets no painel Cloud + Supabase DEV + Vercel Preview/DEV.

### Regras

- Nunca usar PROD por padrão.
- Nunca executar `vercel --prod`.
- Nunca executar migration em PROD.
- Nunca usar `db reset` / `truncate`.
- Supabase padrão = DEV (`yasprgtlqclwsjcshtls`).
- Antes de alterar código: `git fetch origin` e sincronizar a branch de trabalho.
- Antes de finalizar: testes + build.
- DEV autorizado: commit + push + Preview deploy.
- PROD exige aprovação explícita de Philippe.
- Não usar force push automaticamente.
- Não commitar secrets (`.env*`, tokens, service role).
- Não modificar layout fora do escopo solicitado.
- Mudança estrutural/layout relevante exige aprovação de Philippe antes.

### Philippe / Ricardo

- Quem terminar: commit + push + working tree clean.
- Quem começar: sincroniza Git antes de editar.

### Comandos (Linux/Cloud e Windows)

Os scripts do `package.json` são portáveis (`node` / `npm run`).

| Contexto | Install | Build | Preview DEV |
|---|---|---|---|
| Cursor Cloud / Linux | `npm ci` | `npm run build` | `npx vercel deploy` (sem `--prod`) |
| Windows local | `npm.cmd ci` | `npm.cmd run build` | `npx.cmd vercel deploy` (sem `--prod`) |

Não colocar servidor de longa duração no `install` do Cloud.

### Secrets

Secrets entram só no painel Cloud Agent. Nomes e status: `docs/CURSOR_CLOUD.md`.
Nunca gravar valores no Git, em `environment.json` ou em chat.

### Comportamento sem credenciais Supabase (não óbvio)

Os secrets do Supabase DEV (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) precisam estar disponíveis como env vars (painel Cloud) ou em `.env.local`. Sem eles:

- `npm run dev` sobe normalmente; `/` e `/login` renderizam (o middleware ignora auth quando faltam as env vars), mas qualquer rota com dados do Supabase (ex.: `/quotes`) retorna **500** (`Lib/supabase.ts` cria o client no load do módulo e lança `supabaseUrl is required`).
- `npm run build` **falha** em "Collecting page data" (ex.: `/api/auth/logout`) pelo mesmo motivo. Ou seja, build e qualquer fluxo autenticado (login, criar cotação) exigem as credenciais DEV presentes.
- Fluxo autenticado E2E usa o projeto **hosted DEV** (`yasprgtlqclwsjcshtls`), que já tem usuários/tenant/catálogo. Não há `supabase/seed.sql`, então um stack Supabase local sobe vazio (sem tenant/login utilizável).
- Para rodar localmente, copie os secrets para `.env.local` (já em `.gitignore`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ opcional `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`).
- **Troubleshooting:** se `npm run build`/`npm run dev` falhar com `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`, verifique se o valor do secret `NEXT_PUBLIC_SUPABASE_URL` não veio com o nome da variável colado no início — o valor correto é só `https://yasprgtlqclwsjcshtls.supabase.co`. O Next não sobrescreve env vars já presentes no processo, então corrija o secret no painel (ou faça `unset NEXT_PUBLIC_SUPABASE_URL` antes de subir, deixando o `.env.local` prevalecer).
