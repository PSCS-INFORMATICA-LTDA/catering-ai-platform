# Internal Auth E2E QA Harness (DEV only)

Validates the real Catering AI invite → email → callback → provisioning → login → logout → forgot/reset password journey against canonical DEV.

## Target

- App: `https://catering-ai-agenda-dev.vercel.app`
- Supabase DEV: `yasprgtlqclwsjcshtls`
- Company: CDL Services BBQ At Home DEV (`65fd576f-8d97-49ba-bf38-61bc1e94e94a`)

## Run

```bash
export E2E_BASE_URL=https://catering-ai-agenda-dev.vercel.app
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
export CATERING_DEV_LOGIN_EMAIL=...
export CATERING_DEV_LOGIN_PASSWORD=...

# Required for real email link extraction (Gmail plus-alias inbox)
export QA_GMAIL_IMAP_APP_PASSWORD=...

npm run test:e2e:auth
```

## QA identities

Synthetic users only:

`pscs.solutions+catering.qa.<runId>.001@gmail.com` (admin)  
`pscs.solutions+catering.qa.<runId>.002@gmail.com` (operator)

Cleanup is fail-closed to the `pscs.solutions+catering.qa.` prefix.

## Gates

- `EMAIL_HUMAN_GATE_REQUIRED=YES` when Gmail IMAP is not configured
- Never touches Caio, Dani, Juninho, Philippe, or PROD
