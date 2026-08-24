"""Remove the leftover black plate + BB on BBQPERS+ (with-sides) only.

The personalized-with-sides flyers still carry a leftover layer: a dark
rectangle and red BB sitting between GUARNIÇÕES and the official CDL mark.
Earlier tiling left a visible black square. This rebuilds that small area
from the flyer’s own wood, feathers every edge, then copies the official
mark back from the original so the logo never gets covered.

Does not touch BBQPERS without sides.

Run: python3 scripts/dev/remove-folder-black-square.py [--dry-run]
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
BACKUP = '/tmp/folders-v3-backup'
MARKS = os.path.join(PACKAGES, 'folder-badge-locations.json')
REPORT = os.path.join(PACKAGES, 'folder-black-square-removal.json')

# hole = leftover plate + BB. strip = clean wood on the same flyer.
JOBS = {
    'bbqpers-plus-pt-v3.webp': {
        'hole': (204, 1306, 300, 226),
        'strip': (520, 1460, 250, 60),
        'mark_key': 'bbqpers-plus-pt-v2.webp',
    },
}


def mark_circle(mark, pad=6):
    cx = mark['x'] + mark['size'] // 2
    cy = mark['y'] + mark['size'] // 2
    radius = int(mark['size'] * 0.52) + pad
    return cx, cy, radius


def tile_strip(strip, width, height):
    sh, sw = strip.shape[:2]
    reps_x = int(np.ceil(width / sw)) + 2
    reps_y = int(np.ceil(height / sh)) + 2
    tiled = np.tile(strip, (reps_y, reps_x, 1))
    if sh > 4 and reps_y > 1:
        shift = max(12, sw // 5)
        for i in range(1, reps_y):
            y0 = i * sh
            tiled[y0:y0 + sh] = np.roll(tiled[y0:y0 + sh], shift * (i % 2), axis=1)
    return tiled[:height, :width]


def feather_mask(h, w, border):
    mask = np.ones((h, w), np.float32)
    for i in range(border):
        t = (i + 1) / (border + 1)
        # cosine ease so the rectangle does not print as a hard plate
        t = 0.5 - 0.5 * np.cos(np.pi * t)
        mask[i, :] *= t
        mask[h - 1 - i, :] *= t
        mask[:, i] *= t
        mask[:, w - 1 - i] *= t
    return mask


def load_source(name):
    backup = os.path.join(BACKUP, name)
    current = os.path.join(FOLDERS, name)
    if os.path.exists(backup):
        return cv2.imread(backup, cv2.IMREAD_COLOR)
    return cv2.imread(current, cv2.IMREAD_COLOR)


def main():
    dry = '--dry-run' in sys.argv
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)

    report = {}
    for name, job in sorted(JOBS.items()):
        image = load_source(name)
        if image is None:
            report[name] = 'missing'
            continue

        hx, hy, hw, hh = job['hole']
        sx, sy, sw, sh = job['strip']
        hx = max(0, hx)
        hy = max(0, hy)
        hw = min(hw, image.shape[1] - hx)
        hh = min(hh, image.shape[0] - hy)
        strip = image[sy:sy + sh, sx:sx + sw]
        if strip.size == 0 or strip.shape[0] < 8 or strip.shape[1] < 8:
            report[name] = 'strip missing'
            continue

        # Expand into clean wood so the fade is wood-on-wood, never plate-on-wood.
        pad = 22
        ex = max(0, hx - pad)
        ey = max(0, hy - pad)
        ew = min(image.shape[1] - ex, hw + pad * 2)
        eh = min(image.shape[0] - ey, hh + pad * 2)
        fill = tile_strip(strip, ew, eh)
        original = image.copy()
        alpha = np.zeros((eh, ew), np.float32)
        ix0, iy0 = hx - ex, hy - ey
        alpha[iy0:iy0 + hh, ix0:ix0 + hw] = 1.0
        alpha = cv2.GaussianBlur(alpha, (0, 0), 7.5)
        alpha = np.clip(alpha, 0, 1)[:, :, None]
        patched = image.copy()
        target = image[ey:ey + eh, ex:ex + ew].astype(np.float32)
        patched[ey:ey + eh, ex:ex + ew] = np.clip(
            fill.astype(np.float32) * alpha + target * (1.0 - alpha),
            0,
            255,
        ).astype(np.uint8)

        mark = marks.get(job['mark_key'])
        if mark:
            protect = np.zeros(image.shape[:2], np.uint8)
            cx, cy, radius = mark_circle(mark, pad=4)
            cv2.circle(protect, (cx, cy), radius, 255, -1)
            protect = cv2.GaussianBlur(protect, (0, 0), 1.8)
            weight = protect[:, :, None].astype(np.float32) / 255.0
            patched = np.clip(
                original.astype(np.float32) * weight
                + patched.astype(np.float32) * (1.0 - weight),
                0,
                255,
            ).astype(np.uint8)

        dest = os.path.join(FOLDERS, name)
        if not dry:
            cv2.imwrite(dest, patched, [cv2.IMWRITE_WEBP_QUALITY, 92])
        report[name] = f'removed {hw}x{hh} using strip {sw}x{sh} at {sx},{sy}'

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')

    for name, note in sorted(report.items()):
        print(f'  {name}: {note}')
    print(f"cleared {sum(str(v).startswith('removed') for v in report.values())} of {len(report)}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
