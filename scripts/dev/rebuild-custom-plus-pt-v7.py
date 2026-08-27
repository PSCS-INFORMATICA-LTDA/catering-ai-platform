"""Rebuild BBQ Personalizado COM guarnições from the approved SEM art.

Do not patch the previous plus-PT flyer. This starts over:

  BASE  = bbqpers-pt-v4.webp          (Personalizado SEM guarnições)
  SIDES = bbqtrad-plus-pt-v4.webp[1035:]  (Arroz Branco / Feijão Preto / Vinagrete)
  LOGO  = cdl-badge-official.png      (CDL SERVICES / BBQ AT HOME)

Writes bbqpers-plus-pt-v7.webp beside the older plus-PT files so v5/v6 stay
available for rollback.

Run: python3 scripts/dev/rebuild-custom-plus-pt-v7.py
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
BASE = os.path.join(FOLDERS, 'bbqpers-pt-v4.webp')
SIDES = os.path.join(FOLDERS, 'bbqtrad-plus-pt-v4.webp')
DEST = os.path.join(FOLDERS, 'bbqpers-plus-pt-v7.webp')
BADGE = os.path.join(PACKAGES, 'cdl-badge-official.png')
REPORT = os.path.join(PACKAGES, 'folder-custom-plus-rebuild-v7.json')

SIDES_Y0 = 1035
BLEND_H = 72
LOGO_LEFT = 18
LOGO_TOP = 1348
LOGO_SIZE = 176

OLD_FILE = 'bbqpers-plus-pt-v6.webp'
NEW_FILE = 'bbqpers-plus-pt-v7.webp'
BUCKET = 'package-images'
PREFIX = 'cdl-folders-v3'


def smootherstep(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0.0, 1.0)
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def stamp_official_badge(image: np.ndarray, badge: np.ndarray) -> np.ndarray:
    size = LOGO_SIZE
    left = LOGO_LEFT
    top = LOGO_TOP
    stamp = cv2.resize(badge, (size, size), interpolation=cv2.INTER_AREA)
    alpha = stamp[:, :, 3].astype(np.float32) / 255.0
    yy, xx = np.ogrid[:size, :size]
    cx = cy = (size - 1) / 2.0
    radius = size * 0.5
    circle = (((xx - cx) ** 2 + (yy - cy) ** 2) <= radius * radius).astype(
        np.float32,
    )
    # Soften the rim so the mark sits on the table instead of looking pasted.
    inner = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    rim = np.clip((radius - inner) / 2.2, 0.0, 1.0)
    alpha = alpha * circle * rim
    rgb = stamp[:, :, :3].astype(np.float32)
    dest = image[top : top + size, left : left + size].astype(np.float32)
    image[top : top + size, left : left + size] = np.clip(
        rgb * alpha[:, :, None] + dest * (1.0 - alpha[:, :, None]),
        0,
        255,
    ).astype(np.uint8)
    return image


def compose(base: np.ndarray, sides_src: np.ndarray) -> np.ndarray:
    canvas = base.copy()
    sides = sides_src[SIDES_Y0:]
    assert sides.shape[1] == canvas.shape[1]
    assert SIDES_Y0 + sides.shape[0] == canvas.shape[0]

    # Match the dark studio lighting of the hero across a short seam so the
    # real buffet does not sit as a hard bright rectangle.
    pers_lum = float(cv2.cvtColor(base[SIDES_Y0 - 28 : SIDES_Y0], cv2.COLOR_BGR2GRAY).mean())
    sides_lum = float(cv2.cvtColor(sides[:40], cv2.COLOR_BGR2GRAY).mean())
    gain0 = float(np.clip(pers_lum / max(sides_lum, 1.0), 0.55, 1.0))

    fade = np.ones((sides.shape[0], 1, 1), np.float32)
    ramp = smootherstep(np.linspace(0.0, 1.0, BLEND_H, dtype=np.float32))
    fade[:BLEND_H, 0, 0] = gain0 + (1.0 - gain0) * ramp
    graded = np.clip(sides.astype(np.float32) * fade, 0, 255)

    alpha = np.ones((sides.shape[0], sides.shape[1], 1), np.float32)
    alpha[:BLEND_H, :, 0] = ramp[:, None]

    dest = canvas[SIDES_Y0:].astype(np.float32)
    blended = graded * alpha + dest * (1.0 - alpha)
    canvas[SIDES_Y0:] = np.clip(blended, 0, 255).astype(np.uint8)
    return canvas


def main() -> int:
    base = cv2.imread(BASE, cv2.IMREAD_COLOR)
    sides = cv2.imread(SIDES, cv2.IMREAD_COLOR)
    badge = cv2.imread(BADGE, cv2.IMREAD_UNCHANGED)
    if base is None or sides is None or badge is None:
        print('missing base, sides donor, or official badge')
        return 1
    if base.shape != (1536, 1024, 3) or sides.shape != (1536, 1024, 3):
        print('unexpected folder size', base.shape, sides.shape)
        return 1
    if badge.shape[2] != 4:
        print('official badge must be RGBA')
        return 1

    work = compose(base, sides)
    work = stamp_official_badge(work, badge)
    ok = cv2.imwrite(DEST, work, [cv2.IMWRITE_WEBP_QUALITY, 92])
    if not ok:
        print('failed to write', DEST)
        return 1

    top_mae = float(
        np.abs(work[:SIDES_Y0].astype(np.int16) - base[:SIDES_Y0].astype(np.int16)).mean(),
    )
    sides_mae = float(
        np.abs(
            work[SIDES_Y0 + BLEND_H : LOGO_TOP].astype(np.int16)
            - sides[SIDES_Y0 + BLEND_H : LOGO_TOP].astype(np.int16),
        ).mean(),
    )
    report = {
        'base': os.path.basename(BASE),
        'sides_donor': os.path.basename(SIDES),
        'sides_y0': SIDES_Y0,
        'blend_h': BLEND_H,
        'dest': os.path.basename(DEST),
        'logo': {
            'asset': os.path.basename(BADGE),
            'left': LOGO_LEFT,
            'top': LOGO_TOP,
            'size': LOGO_SIZE,
        },
        'top_matches_custom_without_sides_mae': top_mae,
        'sides_match_trad_plus_mae': sides_mae,
        'OLD_IMAGE_PATH': f'{BUCKET}/{PREFIX}/{OLD_FILE}',
        'NEW_IMAGE_PATH': f'{BUCKET}/{PREFIX}/{NEW_FILE}',
        'pioneer': False,
        'price_in_image': False,
    }
    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
