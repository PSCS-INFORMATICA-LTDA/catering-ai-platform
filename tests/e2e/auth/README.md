# Internal Auth E2E QA Harness (DEV only)

Validates the real Catering AI invite → email → callback → provisioning → login → logout → forgot/reset password journey against canonical DEV.

## Canonical target

- Branch: `feat/brasinha-foundation-v0-dev`
- Baseline SHA: `8a2b963ce9d1442e05207f40f17b0277e95a2bd2`
- App: `https://catering-ai-agenda-dev.vercel.app`
- Supabase DEV: `yasprgtlqclwsjcshtls`
- Company: CDL Services BBQ At Home DEV (`65fd576f-8d97-49ba-bf38-61bc1e94e94a`)

No customer user is a QA identity. Caio, Dani and Juninho are explicitly out of scope.

## Runner

The canonical package manifests are intentionally left untouched. The harness uses a pinned test-only Playwright runner:

```bash
node scripts/e2e/run-auth-e2e.mjs
```

If Chromium is not already available in the agent/runtime:

```bash
QA_E2E_INSTALL_BROWSER=1 node scripts/e2e/run-auth-e2e.mjs
```

Required DEV environment values:

```bash
E2E_BASE_URL=https://catering-ai-agenda-dev.vercel.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CATERING_DEV_LOGIN_EMAIL=...
CATERING_DEV_LOGIN_PASSWORD=...
```

Secrets must be injected by the runtime/agent and never committed.

## Real email providers

### External/resumable provider (preferred when mailbox API is handled outside the harness)

Set:

```bash
QA_MAILBOX_PROVIDER=external
QA_EMAIL_LINKS_FILE=/secure/path/auth-links.json
```

The file can start as `{}`. After the real invite/reset email is received by an authorized mailbox integration, write only the corresponding real single-use URL into the file:

```json
{
  "pscs.solutions+catering.qa.<run>.001@gmail.com": {
    "invite": "<real invite URL>",
    "reset": "<real reset URL>"
  }
}
```

URLs containing tokens must never be committed or copied into reports.

The same provider can be supplied inline using `QA_EMAIL_LINKS_JSON`, but a protected runtime file is preferred.

### Optional Gmail IMAP

If the runtime already has authorized Gmail IMAP credentials, the harness can use:

```bash
QA_GMAIL_IMAP_USER=pscs.solutions@gmail.com
QA_GMAIL_IMAP_APP_PASSWORD=...
```

IMAP is optional. The canonical application does not depend on `imapflow` or `mailparser`; those packages are dynamically loaded only when this provider is configured.

## Resume without regenerating invites

When email access or SMTP delivery blocks a run, synthetic state is preserved instead of being deleted.

After the real email link is supplied or the SMTP gate is cleared, rerun:

```bash
QA_E2E_RESUME=1 QA_MAILBOX_PROVIDER=external QA_EMAIL_LINKS_FILE=/secure/path/auth-links.json node scripts/e2e/run-auth-e2e.mjs
```

This reuses the same synthetic identities and existing invite IDs. It must not create a fresh invite just to obtain another email.

## SMTP rate limit

`email rate limit exceeded` is treated as a hard external DEV gate:

```text
SMTP_RATE_LIMIT_BLOCKED=YES
AGGRESSIVE_RETRY=NO
READY_FOR_INDEPENDENT_REVIEW=NO
```

The harness does not hammer the email provider or fabricate Auth state to bypass the limit.

## QA identities

Synthetic users only:

- `pscs.solutions+catering.qa.<runId>.001@gmail.com` → admin
- `pscs.solutions+catering.qa.<runId>.002@gmail.com` → operator
- a third synthetic identity is reserved for resend testing

Cleanup is fail-closed to the `pscs.solutions+catering.qa.` prefix. When an email/SMTP gate is pending, cleanup is deferred so the run can resume safely.

## Safety gates

Required invariants:

```text
CAIO_EMAIL_SENT=NO
DANI_EMAIL_SENT=NO
JUNINHO_EMAIL_SENT=NO
CAIO_DATA_TOUCHED=NO
DANI_DATA_TOUCHED=NO
JUNINHO_DATA_TOUCHED=NO
PROD_TOUCHED=NO
```

The harness is ready for independent review only after two complete synthetic-user journeys plus resend and password-reset flows pass with real email delivery.
