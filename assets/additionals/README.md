# Additional item clean assets

Language-neutral catalog photos for public-quote extras cards.

- Square 1200×1200 WebP
- No localized product names, prices, or UOM inside the photo
- Official CDL circular emblem overlaid (bottom-right), never AI-drawn
- Same file used for PT / EN / ES — UI shows the translated name outside the image

Reused (not regenerated): `FRUTOS_DO_MAR` and `BOVINO_NOBRE`.

Completed 2026-08-20: remaining real extras and equipment.

Compose overlay:

```bash
python3 scripts/dev/compose-additional-clean-asset.py <raw.png> <out.webp>
```
