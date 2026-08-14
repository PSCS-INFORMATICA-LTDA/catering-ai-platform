# Catering AI Platform — Environment Model

**Owner:** Philippe  
**Default environment:** DEV  
**Last updated:** 2026-08-14

## Supabase project refs

| Environment | Project ref | Name (dashboard) |
|-------------|-------------|------------------|
| DEV | `yasprgtlqclwsjcshtls` | catering-ai-platform-DEV |
| PROD | `eapwtirhevxrqinytans` | Production |

Do not document or commit keys/secrets in this file.

## Target model

| Context | Database | Deploy | Write policy |
|---------|----------|--------|--------------|
| **LOCAL / Cursor** | DEV | none | DEV only |
| **Vercel Preview** | DEV | Vercel Preview | DEV only |
| **Vercel Production** | PROD | Vercel Production | Philippe approval only |

### Never

- Preview → PROD
- Local default → PROD
- `service_role` in browser / `NEXT_PUBLIC_*`
- PROD credentials in `.env.local`

## Local setup (DEV)

1. Pull Development variables from Vercel (read-only pull):

```bash
npx vercel env pull .env.vercel.development \
  --environment=development \
  --project catering-ai-platform \
  --scope pscs-informatica-ltda-s-projects \
  --yes
```

2. Sync into `.env.local`:

```bash
node scripts/sync-local-env-from-dev.mjs
```

3. Verify:

```bash
npm run env:check
npm run env:dev:check
```

## Vercel variable scopes (expected)

| Scope | Supabase target |
|-------|-----------------|
| Development | DEV (`yasprgtlqclwsjcshtls`) |
| Preview | DEV (`yasprgtlqclwsjcshtls`) |
| Production | PROD (`eapwtirhevxrqinytans`) |

Production variables on Vercel must **not** be changed without Philippe's explicit approval.

## Supabase CLI

**Default link:** DEV (`yasprgtlqclwsjcshtls`)

```bash
npx supabase login
npx supabase link --project-ref yasprgtlqclwsjcshtls
npx supabase projects list
```

Confirm linked ref:

```bash
# after link
cat supabase/.temp/project-ref
```

### PROD procedure (documented only — do not run casually)

1. Philippe approval  
2. Backup  
3. `npx supabase migration list`  
4. Dry-run / SQL review  
5. Explicit command with `ALLOW_PRODUCTION_WRITE=true`  
6. Link PROD only for the maintenance window:

```bash
# NOT for daily development
npx supabase link --project-ref eapwtirhevxrqinytans
```

7. Re-link DEV when finished:

```bash
npx supabase link --project-ref yasprgtlqclwsjcshtls
```

## Safety scripts

| Script | Purpose |
|--------|---------|
| `npm run env:check` | Show masked refs, branch, Vercel link |
| `npm run env:dev:check` | Fail if local is not DEV |
| `npm run env:prod:check` | Report if local is PROD (diagnostic) |
| `node scripts/guard-production-write.mjs` | Block destructive scripts when local = PROD |

Destructive local scripts should call the guard and require:

```bash
ALLOW_PRODUCTION_WRITE=true
```

This guard does **not** affect normal Vercel Production runtime.

## Git / secrets

- `.env*` is gitignored (includes `.env.local`, `.env.vercel.*`)
- Commit only `.env.example` (no secrets)
- Never commit `SUPABASE_SERVICE_ROLE_KEY`

## Audit checklist

- [ ] `npm run env:dev:check` passes  
- [ ] Preview Vercel vars use DEV ref  
- [ ] Production Vercel vars use PROD ref  
- [ ] Supabase CLI linked to DEV  
- [ ] No PROD write without approval  
