# Pilot additional assets — FRUTOS DO MAR + BOVINO NOBRE

Round: language-neutral extras photos for public quote cards.
Scope: these two categories only. Bovino Tradicional / linguiças / frango untouched.

**PROD ALTERADO: NÃO**

Supabase: DEV project already used by this repository (not PROD)  
DEV URL: https://catering-ai-agenda-dev.vercel.app  
Company: `65fd576f-8d97-49ba-bf38-61bc1e94e94a`  
Bucket (new DEV objects, originals not deleted): `additional-item-images`  
Old flyers remain at `package-images/cdl-prod-sync/catalog_items/{id}.png`

Visual pattern locked after Lagosta / Tomahawk / Wagyu:

- Square 1200×1200 WebP
- Product fills the frame, dark BBQ lighting
- No localized names, prices, badges, or extra copy in the photo
- Official CDL circular emblem (`public/cdl/logo.png` → `assets/additionals/brand/cdl-emblem-circle.png`) bottom-right, ~13% width
- Same file for PT / EN / ES

## Manifest

| Categoria | Item ID | Nome PT / EN / ES | Old Asset | New Clean Asset | Existing/Edit/Generated | Text Removed | Product Enlarged | CDL Logo | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FRUTOS_DO_MAR | `f3ed2393-e472-4538-bd9d-2a4d0ad2b3b9` ITEM_051 | LAGOSTA / LOBSTER / LANGOSTA | `package-images/cdl-prod-sync/catalog_items/f3ed2393-….png` (2.69 MB PNG 1254²) | `assets/additionals/frutos-do-mar/lagosta-clean.webp` + `additional-item-images/…/ITEM_051_clean_v1_20260819.webp` (270 KB) | Edit (reconstructed from flyer) | Yes — LAGOSTA, PREMIUM QUALITY, flyer logo | Yes | Official overlay BR | PASS |
| FRUTOS_DO_MAR | `07a474e8-2431-4761-9f4f-e177c1c7f465` ITEM_050 | CAMARÃO / SHRIMP / CAMARÓN | `…/07a474e8-….png` (2.79 MB) | `camarao-clean.webp` / `ITEM_050_clean_v1_20260819.webp` (226 KB) | Edit | Yes — CAMARÃO + badge | Yes | Official overlay BR | PASS |
| FRUTOS_DO_MAR | `e21f09d3-4e81-4093-ae78-142248804fdc` ITEM_052 | POLVO / OCTOPUS / PULPO | `…/e21f09d3-….png` (2.51 MB) | `polvo-clean.webp` / `ITEM_052_clean_v1_20260819.webp` (211 KB) | Edit | Yes — POLVO | Yes | Official overlay BR | PASS |
| FRUTOS_DO_MAR | `5d35fcdb-c39f-4039-b035-1ba911842e3e` ITEM_053 | VIEIRA / SEA SCALLOP / VIEIRAS | `…/5d35fcdb-….png` (2.33 MB) | `vieira-clean.webp` / `ITEM_053_clean_v1_20260819.webp` (202 KB) | Edit | Yes — VIEIRA | Yes | Official overlay BR | PASS |
| BOVINO_NOBRE | `0d7a294c-d03d-42eb-922b-a2abffd6deeb` ITEM_013 | TOMAHAWK (WAGYU) | `…/0d7a294c-….png` (2.97 MB) | `tomahawk-wagyu-clean.webp` / `ITEM_013_clean_v1_20260819.webp` (218 KB) | Edit | Yes — TOMAHAWK (WAGYU), FOLHEADO A OURO, PREMIUM, VISION2026 | Yes; long bone kept | Official overlay BR | PASS |
| BOVINO_NOBRE | `e395bf13-d94a-47d8-8f08-78b9c8b07c9f` ITEM_012 | TOMAHAWK (ANGUS) | `…/e395bf13-….png` (2.55 MB) | `tomahawk-angus-clean.webp` / `ITEM_012_clean_v1_20260819.webp` (209 KB) | Edit | Yes — TOMAHAWK ANGUS | Yes; long bone kept | Official overlay BR | PASS |
| BOVINO_NOBRE | `a10040e4-7d9e-4093-aaf8-92f536f38b7f` ITEM_011 | T-BONE (ANGUS) | `…/a10040e4-….png` (2.48 MB) | `tbone-angus-clean.webp` / `ITEM_011_clean_v1_20260819.webp` (293 KB) | Edit | Yes — T-BONE ANGUS | Yes; T-bone kept | Official overlay BR | PASS |
| BOVINO_NOBRE | `404c667b-0605-48b8-9ca3-07b510be23bc` ITEM_010 | FRALDINHA (WAGYU) / SKIRT (WAGYU) / ENTRAÑA (WAGYU) | none (`image_status=missing`) | `fraldinha-wagyu-clean.webp` / `ITEM_010_clean_v1_20260819.webp` (297 KB) | Generated | n/a | n/a (new) | Official overlay BR | PASS — generated; long skirt strips |
| BOVINO_NOBRE | `c3cf79ab-b08c-482b-9f15-3d041ab33bab` ITEM_009 | PICANHA (WAGYU) / PICAÑA (WAGYU) | none | `picanha-wagyu-clean.webp` / `ITEM_009_clean_v1_20260819.webp` (357 KB) | Generated | n/a | n/a (new) | Official overlay BR | PASS — generated; fat cap visible |
| BOVINO_NOBRE | `dea84b3f-b2b8-44f3-8754-004d77019664` ITEM_008 | RIBEYE | none | `ribeye-clean.webp` / `ITEM_008_clean_v1_20260819.webp` (295 KB) | Generated | n/a | n/a (new) | Official overlay BR | PASS — generated; boneless ribeye |
| BOVINO_NOBRE | `cae681f1-c7d3-4e5f-b64e-e55fe90cd63b` ITEM_007 | NEW YORK | none | `new-york-clean.webp` / `ITEM_007_clean_v1_20260819.webp` (333 KB) | Generated | n/a | n/a (new) | Official overlay BR | PASS — generated; rectangular strip |

Rollback map: `assets/additionals/pilot-upload-map.json` (old public URLs still HTTP 200).

## Business data

PREÇOS / NOMES / UOM / REGRAS ALTERADOS: **NÃO**

Only `image_url`, `image_status`, `image_notes`, `updated_at` were updated on the 11 pilot rows.

BOVINO TRADICIONAL ALTERADO: **NÃO**

## Browser QA (DEV public quote)

Live extras cards on https://catering-ai-agenda-dev.vercel.app (no redeploy needed; `image_url` is read from DEV catalog).

- PT / EN / ES use the **same** `*_clean_v1_20260819.webp` files. Only the UI name/UOM copy changes (Lagosta / Lobster / Langosta).
- Lagosta card: no “LAGOSTA” in the photo; product fills the square; official CDL emblem bottom-right.
- Select still works (Lagosta → Selecionado + check badge; Ribeye → Selecionado). Prices unchanged.
- Viewports 375 / 390 / 430 / 1440: no horizontal overflow.

### Fraldinha Wagyu in extras

ITEM_010 has a clean asset bound. On package BBQCHO+ (and other packages that already include Fraldinha as a package item with `blocks_additional_item=true`) the extras list hides that catalog row. That is existing package-block logic, not an image failure. Category header then shows **6 itens** instead of 7.

## App checks

No wizard/pricing/UI code changed. `npm run lint` / `npx tsc --noEmit` / `npm run build` were not required for this assets-only revision. There is still no `npm test` / `npm run typecheck` script.

- There is no standalone catalog item named only “Wagyu”. The existing Wagyu photograph was **TOMAHAWK (WAGYU)**.
- Fraldinha Wagyu / Picanha Wagyu in this category are premium extras, not Bovino Tradicional Fraldinha / Picanha Angus.
- Generated steaks are AI food photos in the locked CDL extras style; they are not studio shots of CDL inventory.
