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
