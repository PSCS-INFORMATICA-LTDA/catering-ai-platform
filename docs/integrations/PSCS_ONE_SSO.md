# PSCS One → Catering AI SSO (Catering side)

## Adapter

All PSCS One integration lives under `Lib/pscs-one/`. Pages do not call One APIs directly.

- `PscsOneIdentityService` — server token exchange
- `PscsOneCompanyService` — membership on mapped Catering company UUID
- `PscsOneEntitlementService` — product_key must be `catering_ai`
- `PscsOneSessionAdapter` — local Auth session via magic link hash (no password)

Callback: `GET /auth/pscs-one/callback` (already public in middleware `/auth/`).

## Flag

`PSCS_ONE_SSO_ENABLED=true` only in Catering DEV. Legacy password login on `/login` remains.

## Rollback

Unset the flag. Do not delete Auth users or `/login`.

## Tenant

Cookie `pscs_one_mapped_company_id` is a hint. `getAuthSession` only prefers that company if the user has an active membership. Server APIs that still call `getActiveCompanyId()` use the CDL env default; DEV mapping therefore uses the CDL company UUID so quotes stay consistent in this phase.

## Revocation

Revoked entitlement on PSCS One blocks new SSO. Existing Catering cookies last until Catering Auth expiry (cookie maxAge 8h for the mapping hint). No enterprise session kill switch in this phase.
