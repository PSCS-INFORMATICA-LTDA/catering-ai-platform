"""Fix only the CDL mark on BBQ Personalizado COM guarnições.

The v7 composition is approved (meats, shrimp, rice, beans, vinaigrette,
buffet, crop, lighting, title). The leftover defect is a dark halo around
the stamped badge. This inpaints only a thin rim, then stamps the
official CDL mark with a crisp circle so the old rim cannot leak.

Writes bbqpers-plus-pt-v8.webp beside v7 so rollback is the old filename.

Run: python3 scripts/dev/rebuild-custom-plus-pt-v8.py
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
SRC = os.path.join(FOLDERS, 'bbqpers-plus-pt-v7.webp')
DEST = os.path.join(FOLDERS, 'bbqpers-plus-pt-v8.webp')
BADGE = os.path.join(PACKAGES, 'cdl-badge-official.png')
REPORT = os.path.join(PACKAGES, 'folder-custom-plus-logo-v8.json')

LOGO_LEFT = 18
LOGO_TOP = 1348
LOGO_SIZE = 176
# Only the badge disk plus a 3px rim. A larger circular wood fill
# reads as a halo on the table.
COVER_PAD = 3

OLD_FILE = 'bbqpers-plus-pt-v7.webp'
NEW_FILE = 'bbqpers-plus-pt-v8.webp'
BUCKET = 'package-images'
PREFIX = 'cdl-folders-v3'


def label_protect(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    bright = (gray > 155).astype(np.uint8)
    zone = np.zeros_like(bright)
    zone[1188:1348, 48:640] = bright[1188:1348, 48:640]
    return cv2.dilate(zone, np.ones((13, 19), np.uint8), 1)


def halo_mask(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    cx = LOGO_LEFT + LOGO_SIZE // 2
    cy = LOGO_TOP + LOGO_SIZE // 2
    radius = int(LOGO_SIZE * 0.5) + COVER_PAD
    mask = np.zeros((height, width), np.uint8)
    cv2.circle(mask, (cx, cy), radius, 255, -1)
    mask[label_protect(image) > 0] = 0
    mask[:1310] = 0
    return mask


def restore_table_wood(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Inpaint only the thin rim outside the new stamp. No circular patch."""
    if int((mask > 0).sum()) == 0:
        return image
    protect = label_protect(image)
    fill = cv2.inpaint(image, mask, 2, cv2.INPAINT_TELEA)
    fill[protect > 0] = image[protect > 0]
    return fill


def stamp_official_badge(image: np.ndarray, badge: np.ndarray) -> np.ndarray:
    size = LOGO_SIZE
    left = LOGO_LEFT
    top = LOGO_TOP
    stamp = cv2.resize(badge, (size, size), interpolation=cv2.INTER_AREA)
    raw = stamp[:, :, 3].astype(np.float32) / 255.0
    # Official PNG is already nearly binary. Keep a clean disk, no blur.
    hard = np.where(raw > 0.20, 1.0, 0.0).astype(np.float32)
    yy, xx = np.ogrid[:size, :size]
    cx = cy = (size - 1) / 2.0
    radius = size * 0.498
    circle = (((xx - cx) ** 2 + (yy - cy) ** 2) <= radius * radius).astype(
        np.float32,
    )
    alpha = np.clip(hard * circle, 0, 1)
    rgb = stamp[:, :, :3].astype(np.float32)
    dest = image[top : top + size, left : left + size].astype(np.float32)
    image[top : top + size, left : left + size] = np.clip(
        rgb * alpha[:, :, None] + dest * (1.0 - alpha[:, :, None]),
        0,
        255,
    ).astype(np.uint8)
    return image


def main() -> int:
    src = cv2.imread(SRC, cv2.IMREAD_COLOR)
    badge = cv2.imread(BADGE, cv2.IMREAD_UNCHANGED)
    if src is None or badge is None:
        print('missing v7 source or official badge')
        return 1
    if src.shape != (1536, 1024, 3):
        print('unexpected folder size', src.shape)
        return 1
    if badge.shape[2] != 4:
        print('official badge must be RGBA')
        return 1

    mask = halo_mask(src)
    work = restore_table_wood(src, mask)
    work = stamp_official_badge(work, badge)
    ok = cv2.imwrite(DEST, work, [cv2.IMWRITE_WEBP_QUALITY, 92])
    if not ok:
        print('failed to write', DEST)
        return 1

    changed = np.abs(work.astype(np.int16) - src.astype(np.int16)).mean(axis=2)
    stamp_disk = np.zeros(src.shape[:2], np.uint8)
    cv2.circle(stamp_disk, (106, 1436), 100, 255, -1)
    keep = (mask == 0) & (stamp_disk == 0)
    report = {
        'source': os.path.basename(SRC),
        'dest': os.path.basename(DEST),
        'logo': {
            'asset': os.path.basename(BADGE),
            'left': LOGO_LEFT,
            'top': LOGO_TOP,
            'size': LOGO_SIZE,
            'cover_pad': COVER_PAD,
        },
        'mask_px': int((mask > 0).sum()),
        'outside_logo_mae': float(changed[keep].mean()),
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
