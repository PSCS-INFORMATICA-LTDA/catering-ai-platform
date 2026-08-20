<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Codex Desktop — fluxo compartilhado

**Repositório:** Catering AI Platform / PSCS (`PSCS-INFORMATICA-LTDA/catering-ai-platform`)

**Ambiente padrão:** DEV
**Supabase DEV:** `yasprgtlqclwsjcshtls`
**Branch funcional atual:** `feat/quote-wizard-v2-dev`
**Branch DEV/HML da cotação pública + domínio canônico:** `feat/public-self-service-quote-dev` → `https://catering-ai-agenda-dev.vercel.app`

Fonte compartilhada: GitHub + Supabase DEV + Vercel Preview/DEV. O GitHub é a fonte de verdade; cópias locais nunca prevalecem sobre mudanças remotas sem uma sincronização explícita.

### Regras

- Nunca usar PROD por padrão.
- Nunca executar `vercel --prod`.
- Nunca executar `npx vercel deploy --prod`. Neste projeto Vercel, `--prod` atribui o target Production e já tomou `catering-ai-agenda-dev.vercel.app` mais de uma vez, quebrando a cotação pública (`/quote` → `/login`).
- O domínio DEV canônico deve permanecer com `gitBranch=feat/public-self-service-quote-dev` e `autoAssignCustomDomains=false`. Rebind: `npm run bind:dev:canonical-alias`.
- Nunca executar migration em PROD.
- Nunca usar `db reset` / `truncate`.
- Supabase padrão = DEV (`yasprgtlqclwsjcshtls`).
- Antes de alterar código: confirmar working tree limpa, executar `git fetch origin` e sincronizar a branch de trabalho com `git pull --ff-only`.
- Antes de finalizar: testes + build.
- DEV autorizado: commit + push + Preview deploy.
- PROD exige aprovação explícita de Philippe.
- Não usar force push automaticamente.
- Não commitar secrets (`.env*`, tokens, service role).
- Não modificar layout fora do escopo solicitado.
- Mudança estrutural/layout relevante exige aprovação de Philippe antes.

### Philippe / Ricardo — pull e push obrigatórios

- Cada pessoa usa sua própria conta GitHub e sua própria identidade Git; nunca compartilhar token, senha, chave SSH ou sessão do Codex.
- Quem começar: sincroniza Git antes de editar. Se houver alterações locais não commitadas, o Codex deve parar e explicar antes de tentar pull/rebase.
- Quem terminar: executa as verificações adequadas, cria um commit descritivo, sincroniza novamente e faz push; a working tree deve terminar limpa.
- Imediatamente antes do push: `git pull --rebase origin <branch-atual>`. Se houver conflito, não escolher um lado automaticamente; preservar os dois trabalhos e pedir revisão.
- Nunca usar `git push --force`, `git reset --hard` ou apagar mudanças do outro colaborador.
- Preferir uma branch separada por tarefa/pessoa quando os dois estiverem trabalhando ao mesmo tempo. A branch compartilhada `feat/quote-wizard-v2-dev` só deve ser usada por ambos quando não houver trabalho simultâneo.
- O Codex está autorizado a fazer commit e push das mudanças solicitadas e verificadas neste repositório, sem publicar em PROD.

Fluxo padrão de início:

```text
git status --short --branch
git fetch origin
git pull --ff-only
```

Fluxo padrão de entrega:

```text
npm run lint
npm run build
git status --short
git add somente os arquivos da tarefa
git commit -m "tipo(escopo): resumo"
git pull --rebase origin <branch-atual>
git push origin <branch-atual>
npx vercel deploy --yes
```

O Preview deploy deve ser validado por status `READY` e resposta HTTP antes de informar conclusão. Testes específicos da funcionalidade devem ser executados além de lint/build quando existirem.

### Comandos (Linux/Cloud e Windows)

Os scripts do `package.json` são portáveis (`node` / `npm run`).

| Contexto | Install | Build | Preview DEV |
|---|---|---|---|
| Codex / Linux | `npm ci` | `npm run build` | `npx vercel deploy --yes` (sem `--prod`) |
| Codex Desktop / Windows | `npm.cmd ci` | `npm.cmd run build` | `npx.cmd vercel deploy --yes` (sem `--prod`) |

Não colocar servidor de longa duração no `install` do Cloud.

### Secrets

Secrets entram pelas integrações/ambientes autorizados ou por `.env.local` ignorado pelo Git. Nomes e status históricos: `docs/CURSOR_CLOUD.md`.
Nunca gravar valores no Git, em `environment.json` ou em chat.

### Comportamento sem credenciais Supabase (não óbvio)

Os secrets do Supabase DEV (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) precisam estar disponíveis como env vars (painel Cloud) ou em `.env.local`. Sem eles:

- `npm run dev` sobe normalmente; `/` e `/login` renderizam (o middleware ignora auth quando faltam as env vars), mas qualquer rota com dados do Supabase (ex.: `/quotes`) retorna **500** (`Lib/supabase.ts` cria o client no load do módulo e lança `supabaseUrl is required`).
- `npm run build` **falha** em "Collecting page data" (ex.: `/api/auth/logout`) pelo mesmo motivo. Ou seja, build e qualquer fluxo autenticado (login, criar cotação) exigem as credenciais DEV presentes.
- Fluxo autenticado E2E usa o projeto **hosted DEV** (`yasprgtlqclwsjcshtls`), que já tem usuários/tenant/catálogo. Não há `supabase/seed.sql`, então um stack Supabase local sobe vazio (sem tenant/login utilizável).
