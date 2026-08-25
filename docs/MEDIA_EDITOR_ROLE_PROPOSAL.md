# MEDIA_EDITOR role — proposed, not applied

**Status:** STOP before write. This file is the plan. No migration was applied.

## PROPOSED_CHANGE

Add company role `media_editor` (label: MEDIA_EDITOR / Content Media Editor).

Seed only:

- `media.view`
- `media.manage`
- `catalog.view`

Do **not** grant `media.delete`, quotes, finance, users, roles, commercial rules, inventory adjust, company settings.

Do **not** create the Juninho user in this change.

## WHY_REQUIRED

Current roles that can open `/media` are owner / admin / manager. Those roles also see pricing, quotes, users, and rules.

Juninho needs a least-privilege role. `CompanyRole` and `company_memberships.role` are closed enums/check-backed values, so this cannot be done in application code alone.

## MIGRATION_PLAN

1. Confirm `roles.role_key` accepts a new key (insert `media_editor`).
2. Insert `role_permissions` for the three allow keys only.
3. Extend `Lib/tenant/types.ts` `CompanyRole` and `Lib/auth/permissions.ts` fallback.
4. Users UI: allow owner/admin to assign `media_editor`.
5. QA: media editor can open `/media` and `/media/packages`; cannot open `/users`, `/commercial-rules`, `/quotes` writes, or hard-delete.

## RLS_IMPACT

Existing RLS already uses `private.has_permission(..., 'media.manage'|'media.delete')`.

- No new RLS policy required if the role only receives `media.view` / `media.manage`.
- Storage `company-public-media` already follows the same permission split.
- Do not grant `media.delete`.

## Placement constraint (separate)

`media_assets_placement_check` allows only `hero | how_it_works | video`.

A first-class package-folder draft row in `media_assets` would need that check expanded. This round stores package drafts in Storage prefix `cdl-folders-v3-drafts/` instead, so the published map and public quote stay frozen.
