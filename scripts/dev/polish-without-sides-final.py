"""Clean leftover overlays and broken CDL marks on WITHOUT SIDES flyers.

Uses known badge seats and tight leftover boxes. Reconstructs covered food
from the same flyer only. Writes a new version beside the mapped file.

Run: python3 scripts/dev/polish-without-sides-final.py
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
PREVIEW = '/tmp/art-audit/fixed'
REPORT = os.path.join(PACKAGES, 'folder-without-sides-polish.json')
os.makedirs(PREVIEW, exist_ok=True)

# Traditional EN / Select EN leftover strips are audited and left on v3.
# Reconstruction smeared food; do not emit v5 for those two.
JOBS = [
    {
        'src': 'bbqpers-en-v4.webp',
        'dest': 'bbqpers-en-v5.webp',
        'badge': (68, 1318, 170),
        'smear': (200, 1310, 280, 210),
    },
    {
        'src': 'bbqpers-pt-v4.webp',
        'dest': 'bbqpers-pt-v5.webp',
        'badge': (69, 1311, 182),
        'smear': (220, 1300, 240, 210),
    },
    {
        'src': 'bbqpri-pt-v3.webp',
        'dest': 'bbqpri-pt-v5.webp',
        'badge': (65, 1034, 218),
        'smear': (40, 1220, 280, 220),
    },
    {
        'src': 'bbqpri-en-v4.webp',
        'dest': 'bbqpri-en-v5.webp',
        'badge': (46, 1038, 198),
        'smear': (220, 1040, 220, 210),
    },
    {
        'src': 'bbqtrad-pt-v3.webp',
        'dest': 'bbqtrad-pt-v5.webp',
        'badge': (43, 1235, 218),
        'smear': (240, 1230, 230, 220),
    },
    {
        'src': 'bbqsel-es-v3.webp',
        'dest': 'bbqsel-es-v5.webp',
        'badge': (69, 923, 198),
        'smear': (250, 920, 200, 200),
    },
]


def food_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    meat = ((h <= 25) | (h >= 170)) & (s >= 35) & (v >= 45) & (v <= 230)
    return meat.astype(np.uint8)


def leftover_mask(image: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    h, w = image.shape[:2]
    x, y, bw, bh = box
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(w, x + bw), min(h, y + bh)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mean = cv2.blur(gray.astype(np.float32), (15, 15))
    var = cv2.blur((gray.astype(np.float32) - mean) ** 2, (15, 15))
    std = np.sqrt(np.maximum(var, 0))
    white = ((gray > 165) & (hsv[:, :, 1] < 60)).astype(np.uint8)
    # Graphic leftover red (Q, icons) — not brown meat.
    gfx_red = (
        ((hsv[:, :, 0] <= 6) | (hsv[:, :, 0] >= 172))
        & (hsv[:, :, 1] >= 140)
        & (hsv[:, :, 2] >= 90)
    ).astype(np.uint8)
    flat = ((gray < 38) & (std < 8.0)).astype(np.uint8)
    zone = np.zeros((h, w), np.uint8)
    zone[y0:y1, x0:x1] = 1
    core = np.clip(white + gfx_red, 0, 1) & zone
    core[:, :300] = 0
    if int(core.sum()) < 40:
        return np.zeros((h, w), np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    ys, xs = np.where(core > 0)
    bx0, bx1 = max(x0, int(xs.min()) - 8), min(x1, int(xs.max()) + 8)
    by0, by1 = max(y0, int(ys.min()) - 8), min(y1, int(ys.max()) + 8)
    band = np.zeros((h, w), np.uint8)
    band[by0:by1, bx0:bx1] = 1
    strip = flat & band
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    meat = food_mask(image)
    strip[(lap > 14) & (meat > 0) & (core == 0)] = 0
    mask = np.clip(cv2.dilate(core, np.ones((21, 17), np.uint8)) + strip, 0, 1)
    mask[:, :300] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 11), np.uint8))
    return (mask * 255).astype(np.uint8)


def reconstruct_leftover(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    if int((mask > 0).sum()) < 40:
        return image
    work = image.copy()
    ys, xs = np.where(mask > 0)
    x0, x1 = int(xs.min()), int(xs.max())
    # Walk from the food on the left so each column inherits real texture.
    for x in range(x0, x1 + 1, 12):
        col = np.zeros_like(mask)
        col[:, x : x + 12] = mask[:, x : x + 12]
        if int(col.sum()) == 0:
            continue
        work = cv2.inpaint(work, col, 4, cv2.INPAINT_TELEA)
    return work


def logo_mask(image: np.ndarray, left: int, top: int, size: int, smear: tuple[int, int, int, int] | None) -> np.ndarray:
    h, w = image.shape[:2]
    cx = left + size // 2
    cy = top + size // 2
    mask = np.zeros((h, w), np.uint8)
    cv2.circle(mask, (cx, cy), int(size * 0.5) + 12, 255, -1)
    if smear:
        sx, sy, sw, sh = smear
        plate = np.zeros_like(mask)
        plate[sy : min(h, sy + sh), sx : min(w, sx + sw)] = 255
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        mean = cv2.blur(gray.astype(np.float32), (17, 17))
        var = cv2.blur((gray.astype(np.float32) - mean) ** 2, (17, 17))
        std = np.sqrt(np.maximum(var, 0))
        dark = ((gray < 28) & (std < 11)).astype(np.uint8) * 255
        extra = cv2.bitwise_and(dark, plate)
        extra = cv2.dilate(extra, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
        mask = cv2.bitwise_or(mask, extra)
        mask = cv2.bitwise_or(mask, cv2.bitwise_and(plate, (gray < 18).astype(np.uint8) * 255))
    food = food_mask(image)
    # Do not chew into steaks / shrimp next to the badge.
    protect = cv2.dilate(food, np.ones((5, 5), np.uint8))
    disk = np.zeros_like(mask)
    cv2.circle(disk, (cx, cy), int(size * 0.5) + 6, 255, -1)
    mask[(protect > 0) & (disk == 0)] = 0
    return mask


def fill_texture(image: np.ndarray, mask: np.ndarray, cx: int, cy: int) -> np.ndarray:
    if int((mask > 0).sum()) < 30:
        return image
    height, width = image.shape[:2]
    yy, xx = np.ogrid[:height, :width]
    dx = xx.astype(np.float32) - cx
    dy = yy.astype(np.float32) - cy
    dist = np.sqrt(dx * dx + dy * dy)
    extra = 44.0
    scale = (dist + extra) / np.maximum(dist, 1.0)
    sx = np.clip((cx + dx * scale).astype(np.int32), 0, width - 1)
    sy = np.clip((cy + dy * scale).astype(np.int32), 0, height - 1)
    fill = image.copy()
    ring = mask > 0
    src_ok = mask[sy, sx] == 0
    take = ring & src_ok
    fill[take] = image[sy[take], sx[take]]
    remain = (ring & ~src_ok).astype(np.uint8) * 255
    if int(remain.sum()) > 0:
        fill = cv2.inpaint(fill, remain, 3, cv2.INPAINT_TELEA)
    return fill


def stamp_badge(image: np.ndarray, badge: np.ndarray, left: int, top: int, size: int) -> np.ndarray:
    stamp = cv2.resize(badge, (size, size), interpolation=cv2.INTER_AREA)
    raw = stamp[:, :, 3].astype(np.float32) / 255.0
    hard = np.where(raw > 0.42, 1.0, 0.0).astype(np.float32)
    hard = cv2.GaussianBlur(hard, (0, 0), 0.55)
    yy, xx = np.ogrid[:size, :size]
    cx = cy = (size - 1) / 2.0
    circle = (((xx - cx) ** 2 + (yy - cy) ** 2) <= (size * 0.5) ** 2).astype(np.float32)
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

    report = {}
    for job in JOBS:
        image = cv2.imread(os.path.join(FOLDERS, job['src']), cv2.IMREAD_COLOR)
        if image is None:
            report[job['src']] = {'status': 'missing'}
            continue
        work = image.copy()
        reasons = []
        leftover = None
        if job.get('leftover_box'):
            leftover = leftover_mask(image, job['leftover_box'])
            px = int((leftover > 0).sum())
            work = reconstruct_leftover(work, leftover)
            reasons.append(f'leftover px={px}')
            overlay = image.copy()
            overlay[leftover > 0] = (0, 255, 255)
            cv2.imwrite(
                os.path.join(PREVIEW, job['src'].replace('.webp', '-mask.jpg')),
                cv2.addWeighted(image, 0.7, overlay, 0.3, 0),
            )

        left, top, size = job['badge']
        lmask = logo_mask(work, left, top, size, job.get('smear'))
        work = fill_texture(work, lmask, left + size // 2, top + size // 2)
        work = stamp_badge(work, badge, left, top, size)
        reasons.append(f'logo {left},{top},{size}')

        dest = os.path.join(FOLDERS, job['dest'])
        cv2.imwrite(dest, work, [cv2.IMWRITE_WEBP_QUALITY, 92])
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-thumb.jpg')),
            cv2.resize(work, (360, 540)),
        )
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-logo.jpg')),
            work[max(0, top - 30) : top + size + 70, max(0, left - 10) : left + size + 150],
        )
        report[job['src']] = {
            'dest': job['dest'],
            'reasons': reasons,
            'leftover_px': int((leftover > 0).sum()) if leftover is not None else 0,
            'OLD_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["src"]}',
            'NEW_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["dest"]}',
        }
        print(f'{job["src"]} -> {job["dest"]} {reasons}')

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
