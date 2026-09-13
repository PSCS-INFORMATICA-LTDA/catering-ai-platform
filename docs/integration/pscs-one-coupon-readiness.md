# PSCS One — Coupon Center readiness

**Round:** prepare, do not integrate  
**Product name:** PSCS One  
**This module owner today:** Catering AI  
**Forbidden in this round:** shared database, remote FK, runtime coupling, Kafka, new bus, Party parallel model

Catering continues to use its canonical customer, quote and coupon model. PSCS One may later become the shared Party / identity and commercial-event hub. The mapping below is stable vocabulary only.

## Concept map

| Future PSCS One concept | Current Catering owner | Canonical ID today | Tenant | Customer / Party | Audit actor | Future integration | Do not duplicate |
|-------------------------|------------------------|--------------------|--------|------------------|-------------|--------------------|------------------|
| tenant / company | `companies` | `companies.id` | self | n/a | n/a | adapter by company_id | company name/email as identity |
| party / customer | `customers` | `customers.id` | `customers.company_id` | self | customer create/update actors | external `catering_customer_id ↔ pscs_one_party_id` | name, raw phone, email case |
| actor / user | `app_users` / session `userId` | session user id | company membership | n/a | `created_by`, `approved_by`, `rejected_by` | SSO actor already exists | a second user directory |
| quote | `quotes` | `quotes.id` | `quotes.company_id` | `quotes.customer_id` | quote actors | keep Catering as commercial SoR | live coupon re-price |
| quote_version | `quote_versions` | `quote_versions.id` | `quote_versions.company_id` | via quote | version actors | snapshot is the historical fact | current coupon definition |
| coupon / promotion | `coupons` | `coupons.id` | `coupons.company_id` | eligibility via customer id/phone_normalized | `created_by`, `updated_by` | catalog of promotions may later sync | a second coupon table |
| coupon_application | `quote_coupon_applications` | `quote_coupon_applications.id` | `company_id` | via quote.customer_id | `approved_by` / `rejected_by` | application is the commercial event | browser discount amount |
| approval | `approval_status` on application | application id + status | company | via quote | approver user id | pending must stay Catering-guarded | client-supplied status |

## Customer / Party future link

```text
catering_customer_id  ↔  pscs_one_party_id
```

This link must be adapter-based and external. Do not add a remote foreign key. Catering eligibility today uses `customers.phone_normalized` plus `customers.id`, not free-text name/email.

## Future events — contract only

Catering already has `finance_integration_outbox` for `invoice.*` and `payment.*`. That table is the finance consolidation outbox. It is **not** used for coupon events in this round.

If PSCS One later consumes catering commercial events, reuse the existing envelope style:

- `event_id`
- `event_type`
- `occurred_at`
- `source` = `catering_ai`
- `tenant_id` = `company_id`
- `party_id` = future mapped party, optional
- `quote_id`
- `quote_version_id`
- `coupon_id`
- `coupon_application_id`
- `currency`
- `amount`
- `status`

Conceptual types (not published yet):

- `catering.coupon.requested.v1`
- `catering.coupon.approved.v1`
- `catering.coupon.rejected.v1`
- `catering.coupon.applied.v1`
- `catering.quote.pricing_finalized.v1`

Do not create a new queue, Kafka topic or coupon outbox table until PSCS One accepts a receiver contract.
