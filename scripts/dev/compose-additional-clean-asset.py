#!/usr/bin/env python3
"""Overlay the official circular CDL emblem onto a language-neutral food photo.

Does not recreate the logo. Source emblem: assets/additionals/brand/cdl-emblem-circle.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EMBLEM = REPO_ROOT / "assets/additionals/brand/cdl-emblem-circle.png"
OUTPUT_SIZE = 1200
LOGO_RATIO = 0.13
MARGIN_RATIO = 0.045


def compose(
    photo_path: Path,
    out_path: Path,
    emblem_path: Path = DEFAULT_EMBLEM,
    size: int = OUTPUT_SIZE,
    logo_ratio: float = LOGO_RATIO,
) -> None:
    photo = Image.open(photo_path).convert("RGB")
    side = min(photo.size)
    left = (photo.width - side) // 2
    top = (photo.height - side) // 2
    square = photo.crop((left, top, left + side, top + side)).resize(
        (size, size), Image.Resampling.LANCZOS
    )

    canvas = square.convert("RGBA")
    emblem = Image.open(emblem_path).convert("RGBA")
    logo_px = max(72, int(size * logo_ratio))
    emblem = emblem.resize((logo_px, logo_px), Image.Resampling.LANCZOS)

    margin = int(size * MARGIN_RATIO)
    x = size - logo_px - margin
    y = size - logo_px - margin
    canvas.alpha_composite(emblem, (x, y))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    rgb = canvas.convert("RGB")
    suffix = out_path.suffix.lower()
    if suffix == ".webp":
        rgb.save(out_path, format="WEBP", quality=82, method=6)
    elif suffix in {".jpg", ".jpeg"}:
        rgb.save(out_path, format="JPEG", quality=88, optimize=True)
    else:
        rgb.save(out_path, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photo")
    parser.add_argument("out")
    parser.add_argument("--emblem", default=str(DEFAULT_EMBLEM))
    args = parser.parse_args()
    compose(Path(args.photo), Path(args.out), Path(args.emblem))
    out = Path(args.out)
    print(f"wrote {out} bytes={out.stat().st_size}")


if __name__ == "__main__":
    main()
