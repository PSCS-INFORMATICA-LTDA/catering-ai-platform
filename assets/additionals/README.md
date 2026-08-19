# Additional item clean assets (pilot)

Language-neutral catalog photos for public-quote extras cards.

- Square 1200×1200 WebP
- No localized product names, prices, or UOM inside the photo
- Official CDL circular emblem overlaid (bottom-right), never AI-redrawn
- Same file used for PT / EN / ES — UI shows the translated name outside the image

Pilot categories only: `FRUTOS_DO_MAR` and `BOVINO_NOBRE`.

Compose overlay:

```bash
python3 scripts/dev/compose-additional-clean-asset.py <raw.png> <out.webp>
```
