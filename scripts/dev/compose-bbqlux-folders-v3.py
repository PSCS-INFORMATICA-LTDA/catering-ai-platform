#!/usr/bin/env python3
"""Compose localized Luxury folder overlays for the V5 media pilot.

Does not regenerate other packages. Output is 1024x1536 webp:
  bbqlux-{pt,en,es}-v3.webp
  bbqlux-plus-{pt,en,es}-v3.webp
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = Path("/opt/cursor/artifacts/assets")
OUT_DIR = ROOT / "assets" / "packages" / "folders-v3"
BADGE = ROOT / "assets" / "packages" / "cdl-badge-official.png"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

SIZE = (1024, 1536)
VARIANTS = {
    "without": {
        "raw": RAW_DIR / "bbqlux_without_sides_raw.png",
        "prefix": "bbqlux",
        "labels": {
            "pt": "SEM GUARNIÇÕES",
            "en": "WITHOUT SIDES",
            "es": "SIN ACOMPAÑAMIENTOS",
        },
    },
    "with": {
        "raw": RAW_DIR / "bbqlux_with_sides_raw.png",
        "prefix": "bbqlux-plus",
        "labels": {
            "pt": "COM GUARNIÇÕES",
            "en": "WITH SIDES",
            "es": "CON ACOMPAÑAMIENTOS",
        },
    },
}


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def fit_cover(photo: Image.Image) -> Image.Image:
    src = photo.convert("RGB")
    scale = max(SIZE[0] / src.width, SIZE[1] / src.height)
    resized = src.resize(
        (max(1, int(src.width * scale)), max(1, int(src.height * scale))),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - SIZE[0]) // 2
    top = (resized.height - SIZE[1]) // 2
    return resized.crop((left, top, left + SIZE[0], top + SIZE[1]))


def stamp_badge(canvas: Image.Image) -> None:
    badge = Image.open(BADGE).convert("RGBA")
    size = 168
    badge = badge.resize((size, size), Image.Resampling.LANCZOS)
    x, y = 28, SIZE[1] - size - 36
    canvas.alpha_composite(badge, (x, y))


def compose(raw_path: Path, variant_label: str, dest: Path) -> None:
    base = fit_cover(Image.open(raw_path)).convert("RGBA")
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Top readability band — keeps LUXURY readable without hiding the food.
    for y in range(0, 360):
        alpha = int(200 * (1 - y / 360))
        draw.line([(0, y), (SIZE[0], y)], fill=(0, 0, 0, alpha))

    title_font = font(86)
    title = "LUXURY"
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    draw.text(
        ((SIZE[0] - title_w) / 2, 46),
        title,
        font=title_font,
        fill=(212, 160, 23, 255),
    )

    badge_font = font(28)
    pad_x, pad_y = 22, 12
    label_bbox = draw.textbbox((0, 0), variant_label, font=badge_font)
    label_w = label_bbox[2] - label_bbox[0]
    label_h = label_bbox[3] - label_bbox[1]
    box_w = label_w + pad_x * 2
    box_h = label_h + pad_y * 2
    box_x = (SIZE[0] - box_w) / 2
    box_y = 150
    draw.rounded_rectangle(
        (box_x, box_y, box_x + box_w, box_y + box_h),
        radius=6,
        fill=(153, 27, 27, 235),
    )
    draw.text(
        (box_x + pad_x, box_y + pad_y - 2),
        variant_label,
        font=badge_font,
        fill=(255, 255, 255, 255),
    )

    composed = Image.alpha_composite(base, overlay)
    stamp_badge(composed)
    dest.parent.mkdir(parents=True, exist_ok=True)
    rgb = composed.convert("RGB")
    rgb.save(dest, format="WEBP", quality=84, method=6)
    print(f"wrote {dest} bytes={dest.stat().st_size}")


def main() -> None:
    if not BADGE.exists():
        raise SystemExit(f"missing badge {BADGE}")
    for spec in VARIANTS.values():
        if not spec["raw"].exists():
            raise SystemExit(f"missing raw {spec['raw']}")
        for locale, label in spec["labels"].items():
            dest = OUT_DIR / f"{spec['prefix']}-{locale}-v3.webp"
            compose(spec["raw"], label, dest)


if __name__ == "__main__":
    main()
