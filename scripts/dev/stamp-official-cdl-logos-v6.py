"""Stamp the official CDL badge on existing folder arts.

Edits the Git folders in place as new versions. Does not replace the flyer
with a clean photo, does not rewrite titles/items, and does not inpaint
leftover food. Only the badge disk plus a nearby smear plate is cleaned.

Run: python3 scripts/dev/stamp-official-cdl-logos-v6.py
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
BADGE = os.path.join(PACKAGES, 'cdl-badge-official.png')
PREVIEW = '/tmp/art-audit/round2/stamped'
REPORT = os.path.join(PACKAGES, 'folder-official-logo-v6.json')
os.makedirs(PREVIEW, exist_ok=True)

# Known seats from the existing folders. Smear plates sit beside the badge,
# never over leftover food strips on Traditional EN / Select EN.
JOBS = [
    {
        'src': 'bbqpers-pt-v5.webp',
        'dest': 'bbqpers-pt-v6.webp',
        'badge': (69, 1311, 182),
        'smear': (220, 1300, 240, 210),
        'pad': 5,
    },
    {
        'src': 'bbqpers-en-v5.webp',
        'dest': 'bbqpers-en-v6.webp',
        'badge': (68, 1318, 170),
        'smear': (200, 1310, 280, 210),
        'pad': 5,
    },
    {
        'src': 'bbqpers-es-v4.webp',
        'dest': 'bbqpers-es-v6.webp',
        'badge': (42, 1287, 214),
        'smear': (220, 1280, 260, 230),
        'pad': 5,
    },
    {
        'src': 'bbqpers-plus-en-v4.webp',
        'dest': 'bbqpers-plus-en-v6.webp',
        'badge': (50, 1364, 146),
        'smear': (180, 1360, 240, 180),
        'pad': 4,
    },
    {
        'src': 'bbqpers-plus-es-v4.webp',
        'dest': 'bbqpers-plus-es-v6.webp',
        'badge': (61, 1357, 142),
        'smear': (180, 1350, 320, 190),
        'pad': 4,
    },
    {
        'src': 'bbqpri-pt-v5.webp',
        'dest': 'bbqpri-pt-v6.webp',
        'badge': (65, 1034, 218),
        'smear': (40, 1220, 280, 220),
        'pad': 6,
    },
    {
        'src': 'bbqpri-en-v5.webp',
        'dest': 'bbqpri-en-v6.webp',
        'badge': (46, 1038, 198),
        'smear': (220, 1040, 240, 220),
        'pad': 6,
    },
    {
        'src': 'bbqtrad-pt-v5.webp',
        'dest': 'bbqtrad-pt-v6.webp',
        'badge': (43, 1235, 218),
        'smear': (240, 1230, 230, 220),
        'pad': 6,
    },
    {
        'src': 'bbqcho-pt-v3.webp',
        'dest': 'bbqcho-pt-v6.webp',
        'badge': (61, 943, 190),
        'smear': (230, 940, 200, 200),
        'pad': 5,
    },
]


def food_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    meat = ((h <= 25) | (h >= 170)) & (s >= 35) & (v >= 45) & (v <= 230)
    return meat.astype(np.uint8)


def smear_mask(
    image: np.ndarray,
    left: int,
    top: int,
    size: int,
    smear: tuple[int, int, int, int],
    pad: int,
) -> np.ndarray:
    h, w = image.shape[:2]
    cx = left + size // 2
    cy = top + size // 2
    mask = np.zeros((h, w), np.uint8)
    cv2.circle(mask, (cx, cy), int(size * 0.5) + pad, 255, -1)
    sx, sy, sw, sh = smear
    plate = np.zeros_like(mask)
    plate[sy : min(h, sy + sh), sx : min(w, sx + sw)] = 255
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mean = cv2.blur(gray.astype(np.float32), (17, 17))
    var = cv2.blur((gray.astype(np.float32) - mean) ** 2, (17, 17))
    std = np.sqrt(np.maximum(var, 0))
    dark = ((gray < 32) & (std < 12)).astype(np.uint8) * 255
    extra = cv2.bitwise_and(dark, plate)
    extra = cv2.dilate(extra, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    mask = cv2.bitwise_or(mask, extra)
    food = cv2.dilate(food_mask(image), np.ones((5, 5), np.uint8))
    disk = np.zeros_like(mask)
    cv2.circle(disk, (cx, cy), int(size * 0.5) + 4, 255, -1)
    mask[(food > 0) & (disk == 0)] = 0
    return mask


def restore_background(
    image: np.ndarray,
    mask: np.ndarray,
    left: int,
    top: int,
    size: int,
) -> np.ndarray:
    """Inpaint only the thin rim. The badge disk is covered by the official stamp.

    A large smear inpaint reads as a new patch, so we never fill the whole plate.
    """
    h, w = image.shape[:2]
    cx = left + size // 2
    cy = top + size // 2
    disk = np.zeros((h, w), np.uint8)
    cv2.circle(disk, (cx, cy), int(size * 0.5) - 1, 255, -1)
    rim = cv2.subtract(mask, disk)
    # Keep the rim tight — drop far smear that would become a mud blotch.
    far = np.zeros_like(rim)
    cv2.circle(far, (cx, cy), int(size * 0.5) + 8, 255, -1)
    rim = cv2.bitwise_and(rim, far)
    if int((rim > 0).sum()) == 0:
        return image
    return cv2.inpaint(image, rim, 2, cv2.INPAINT_TELEA)


def stamp_official(
    image: np.ndarray,
    badge: np.ndarray,
    left: int,
    top: int,
    size: int,
) -> np.ndarray:
    stamp = cv2.resize(badge, (size, size), interpolation=cv2.INTER_AREA)
    raw = stamp[:, :, 3].astype(np.float32) / 255.0
    hard = np.where(raw > 0.20, 1.0, 0.0).astype(np.float32)
    yy, xx = np.ogrid[:size, :size]
    c = (size - 1) / 2.0
    circle = (((xx - c) ** 2 + (yy - c) ** 2) <= (size * 0.498) ** 2).astype(
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
    badge = cv2.imread(BADGE, cv2.IMREAD_UNCHANGED)
    if badge is None or badge.shape[2] != 4:
        print('official badge missing')
        return 1

    report = {
        'official_badge': os.path.basename(BADGE),
        'ai_generated_logo': False,
        'jobs': {},
    }
    for job in JOBS:
        src = os.path.join(FOLDERS, job['src'])
        image = cv2.imread(src, cv2.IMREAD_COLOR)
        if image is None:
            report['jobs'][job['src']] = {'status': 'missing'}
            continue
        left, top, size = job['badge']
        mask = smear_mask(image, left, top, size, job['smear'], job['pad'])
        work = restore_background(image, mask, left, top, size)
        work = stamp_official(work, badge, left, top, size)
        dest = os.path.join(FOLDERS, job['dest'])
        cv2.imwrite(dest, work, [cv2.IMWRITE_WEBP_QUALITY, 92])
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-full.jpg')),
            cv2.resize(work, (360, 540)),
            [int(cv2.IMWRITE_JPEG_QUALITY), 86],
        )
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-logo.jpg')),
            work[
                max(0, top - 40) : top + size + 70,
                max(0, left - 20) : left + size + 140,
            ],
            [int(cv2.IMWRITE_JPEG_QUALITY), 90],
        )
        changed = np.abs(work.astype(np.int16) - image.astype(np.int16)).mean(
            axis=2,
        )
        keep = mask == 0
        keep[top : top + size, left : left + size] = False
        report['jobs'][job['src']] = {
            'dest': job['dest'],
            'badge': job['badge'],
            'mask_px': int((mask > 0).sum()),
            'outside_mae': float(changed[keep].mean()) if keep.any() else 0.0,
            'OLD_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["src"]}',
            'NEW_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["dest"]}',
        }
        print(f'{job["src"]} -> {job["dest"]} mask={int((mask > 0).sum())}')

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
