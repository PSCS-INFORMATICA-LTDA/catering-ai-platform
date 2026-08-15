# Cursor Cloud — ambiente compartilhado (DEV)

**Owner:** Philippe  
**Uso:** Philippe + Ricardo  
**Default:** DEV  
**PROD:** não configurar para write neste ambiente.

## O que fica no Git

- `.cursor/environment.json` — `npm ci` no Ubuntu do Cloud Agent
- `AGENTS.md` — regras operacionais
- `.env.example` — nomes das variáveis, sem valores
- `package-lock.json` — install idempotente

## O que NÃO fica no Git

- `.env.local`
- tokens Vercel / Supabase
- `SUPABASE_SERVICE_ROLE_KEY`
- chave Google Maps
- qualquer secret PROD

## Secrets no painel Cloud Agent

Adicionar em **Cursor → Cloud Agents → Secrets** (environment / team).  
Não imprimir valores. Não criar secrets PROD.

| Nome | Obrigatório | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | Deve apontar para `https://yasprgtlqclwsjcshtls.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Anon key do projeto DEV |
| `SUPABASE_SERVICE_ROLE_KEY` | sim (server/testes) | Service role DEV; nunca em `NEXT_PUBLIC_*` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | sim (wizard endereço/milhagem) | Geocoding, Maps JS, Distance Matrix |
| `VERCEL_TOKEN` | sim para Preview via Cloud | Token de equipe; deploy sem `--prod` |
| `VERCEL_ORG_ID` | recomendado para deploy | Scope `pscs-informatica-ltda-s-projects` |
| `VERCEL_PROJECT_ID` | recomendado para deploy | Projeto `catering-ai-platform` |
| `SUPABASE_ACCESS_TOKEN` | só se o agent for usar Supabase CLI autenticado | `npx supabase` (link/list). Não versionar. |

Google Maps no Cloud deve cobrir ZIP/CEP, Geocoding, Maps JavaScript e a Distance Matrix/rota atual. Restringir a chave no Google Cloud ao DEV/Preview.

## Supabase

Cloud Agent opera somente contra DEV: `yasprgtlqclwsjcshtls`.  
Não linkar PROD. Não rodar `db reset`.

## Vercel

Fluxo autorizado no Cloud:

```bash
npm ci
npm run build
git commit
git push
npx vercel deploy
```

Nunca `npx vercel deploy --prod` neste ambiente.

Alias DEV atual: `https://catering-ai-agenda-dev.vercel.app` (Preview, não Production).

## Node

- Requisito do projeto: Node `>=20.9.0` (Next.js 16)
- Cloud atual: Node 22.x
- Install: `npm ci` (lockfile)

## Verificação

```bash
npm ci
npm run env:check
npm run build
npm run test:dev:quote-wizard-v2
npm run test:dev:quote-pricing-ssot
```
