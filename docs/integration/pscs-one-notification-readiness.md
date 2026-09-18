# PSCS One — Notification Center readiness

**Round:** first Catering WhatsApp, do not rebuild PSCS One  
**Product name:** PSCS One  
**Platform owner:** PSCS Informática Ltda.  
**This module owner today:** Catering AI  
**Forbidden in this round:** new company registry, remote FK, Implementation Studio, extracted notification service, assumed equal tenant IDs

Catering keeps its own notification catalog, recipients, events, deliveries and audit. PSCS One remains the shared identity / company registry. This file is the integration contract only.

## Shared sender is not shared data

Technical WhatsApp Cloud API connection is administered by PSCS Informática.

| Now | Later |
|-----|--------|
| Platform sender → authorized internal recipients of a linked company | Company-owned sender → that company's customers, after a separate connection and authorization |

Empresa B never receives CDL events, never inherits Caio's phone, never uses a credential/sender without an explicit link, and never reads another company's transactions.

## Concept map

| PSCS One / platform concept | Current Catering owner | Canonical ID today | Tenant | Do not assume | Do not duplicate |
|-----------------------------|------------------------|--------------------|--------|---------------|------------------|
| tenant / company | `companies` | `companies.id` | self | One ID equals Catering ID | a second company cadastro |
| mapped company | `Lib/pscs-one` SSO `external_company_id` | Catering `companies.id` after official mapping | membership | raw One UUID without adapter | cookie as authorization |
| actor / user | `app_users` + `pscs_one_user_id` | session user id | company membership | One user id as Catering PK | a second user directory |
| party / person | `customers` | `customers.id` | `customers.company_id` | phone as identity | publishing private phones |
| provider connection | PSCS-managed Meta app / WABA | env + Vault, not git | platform | App Secret equals Access Token | one Meta app per company by default |
| sender resource | `company_notification_providers` | row `(company_id, channel, provider)` | company | missing row inherits CDL sender | Caio's commercial WhatsApp number |
| authorized companies | `WHATSAPP_SHARED_SENDER_COMPANY_IDS` and/or `provider=pscs_shared` | Catering company UUID allowlist | explicit | allow-all | Empresa B on the CDL list |
| recipients | `notification_recipients` | recipient id | `company_id` | contact exists = consent | cross-company phone copy |
| event subscriptions | `notification_subscriptions` | `(company_id, recipient_id, event_key)` | company | | |
| events | `notification_events` | `(company_id, event_key, entity_id)` | company | | |
| deliveries / audit | `notification_deliveries` | idempotency key | company | | silent global credential fallback |

Official mapping today: PSCS One SSO `identity.external_company_id` → Catering `companies.id` via `Lib/pscs-one`. Cookie `pscs_one_mapped_company_id` is a hint, not a grant.

Read-only consult of PSCS One DEV registry (`uvyaqklvqcakwfvfopof`, not modified):

| One object | Role | Verified columns |
|------------|------|------------------|
| `tenant_registry` | Source of Truth for tenant/data-plane | `company_id`, `environment`, `data_plane_id`, `status` |
| `product_company_mappings` | Official product ↔ external company map | `company_id` (One), `product_id`, `external_system`, `external_company_id`, `environment`, `status` |
| `tenant_data_planes` | Data-plane metadata | `alias`, `provider`, `project_ref_public`, `environment` |
| `companies` | One company registry | `id`, `code`, `legal_name` — not Catering `companies.id` |

CDL Catering `65fd576f-8d97-49ba-bf38-61bc1e94e94a` appears as `external_company_id` on a DEV mapping whose One `company_id` is different and whose mapping `status` is `planned`. Tenant IDs are not interchangeable. Do not treat One `company_id` as a Catering notification `company_id`.

## Future events — contract only

Reuse the existing envelope style already used by `finance_integration_outbox`. Do not create a second bus.

- `event_id`
- `event_type`
- `occurred_at`
- `source` = `catering_ai`
- `tenant_id` = Catering `company_id`
- `party_id` = future mapped party, optional
- `quote_id` / `invoice_id` / `payment_id`

Conceptual types (not published yet):

- `catering.notification.quote_created.v1`
- `catering.notification.quote_accepted.v1`
- `catering.notification.payment_deposit_received.v1`
- `catering.notification.payment_full_received.v1`

Do not extract a platform notification service until PSCS One accepts a receiver/connection contract. The first Catering WhatsApp must not wait for that rebuild.
