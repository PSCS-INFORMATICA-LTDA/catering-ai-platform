"""Remove the stray BBQ/BB fragment beside the CDL mark on personalized folders.

The V3 BBQPERS / BBQPERS+ flyers kept a leftover layer to the right of the
official CDL mark: a dark box and, on PT especially, a large red "BB". The
mark itself is official and must not be redrawn.

A measured strip of the flyer's own surface is tiled over a tight hole and
feathered at the edge only. Poisson blending is not used — it reconstructed
the mark. The official mark is copied back from the original afterwards.

Run: python3 scripts/dev/remove-folder-stray-bb.py [--dry-run]
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
MARKS = os.path.join(PACKAGES, 'folder-badge-locations.json')
REPORT = os.path.join(PACKAGES, 'folder-stray-bb-removal.json')

# hole = leftover box / letters. strip = clean native texture, never overlapping the mark.
JOBS = {
    'bbqpers-plus-pt-v3.webp': {
        'hole': (198, 1304, 310, 188),
        'strip': (540, 1464, 340, 66),
    },
    'bbqpers-plus-en-v3.webp': {
        'hole': (176, 1366, 270, 160),
        'strip': (520, 1472, 320, 60),
    },
    'bbqpers-plus-es-v3.webp': {
        'hole': (186, 1348, 280, 164),
        'strip': (580, 1470, 320, 60),
    },
    'bbqpers-pt-v3.webp': {
        'hole': (230, 1322, 270, 168),
        'strip': (520, 1494, 480, 38),
    },
    'bbqpers-en-v3.webp': {
        'hole': (216, 1330, 270, 164),
        'strip': (520, 1494, 480, 38),
    },
    'bbqpers-es-v3.webp': {
        'hole': (230, 1304, 286, 184),
        'strip': (540, 1490, 460, 42),
    },
}


def mark_circle(mark, pad=8):
    cx = mark['x'] + mark['size'] // 2
    cy = mark['y'] + mark['size'] // 2
    radius = int(mark['size'] * 0.52) + pad
    return cx, cy, radius


def tile_strip(strip, width, height):
    sh, sw = strip.shape[:2]
    reps_x = int(np.ceil(width / sw)) + 1
    reps_y = int(np.ceil(height / sh)) + 1
    tiled = np.tile(strip, (reps_y, reps_x, 1))
    if sh > 4 and reps_y > 1:
        shift = max(8, sw // 4)
        for i in range(1, reps_y):
            y0 = i * sh
            tiled[y0:y0 + sh] = np.roll(tiled[y0:y0 + sh], shift * (i % 2), axis=1)
    return tiled[:height, :width]


def feather_mask(h, w, border):
    """Solid fill against the logo edge; only the free sides are feathered.

    The leftover letters sit flush with the mark. Feathering the left edge
    (or padding the mark protect) put those letters back.
    """
    mask = np.ones((h, w), np.float32)
    for i in range(border):
        t = (i + 1) / (border + 1)
        mask[i, :] *= t
        mask[h - 1 - i, :] *= t
        mask[:, w - 1 - i] *= t
    return mask


def main():
    dry = '--dry-run' in sys.argv
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)

    report = {}
    for name, job in sorted(JOBS.items()):
        path = os.path.join(FOLDERS, name)
        image = cv2.imread(path, cv2.IMREAD_COLOR)
        if image is None:
            report[name] = 'missing'
            continue

        hx, hy, hw, hh = job['hole']
        sx, sy, sw, sh = job['strip']
        strip = image[sy:sy + sh, sx:sx + sw]
        if strip.size == 0 or strip.shape[0] < 8 or strip.shape[1] < 8:
            report[name] = 'strip missing'
            continue

        fill = tile_strip(strip, hw, hh)
        original = image.copy()
        target = image[hy:hy + hh, hx:hx + hw].astype(np.float32)
        alpha = feather_mask(hh, hw, 10)[:, :, None]
        patched = image.copy()
        patched[hy:hy + hh, hx:hx + hw] = np.clip(
            fill.astype(np.float32) * alpha + target * (1.0 - alpha),
            0,
            255,
        ).astype(np.uint8)

        mark = marks.get(name.replace('-v3.webp', '-v2.webp'))
        if mark:
            protect = np.zeros(image.shape[:2], np.uint8)
            cx, cy, radius = mark_circle(mark, pad=1)
            cv2.circle(protect, (cx, cy), radius, 255, -1)
            protect = cv2.GaussianBlur(protect, (0, 0), 2)
            weight = protect[:, :, None].astype(np.float32) / 255.0
            patched = np.clip(
                original.astype(np.float32) * weight
                + patched.astype(np.float32) * (1.0 - weight),
                0,
                255,
            ).astype(np.uint8)

        if not dry:
            cv2.imwrite(path, patched, [cv2.IMWRITE_WEBP_QUALITY, 92])
        report[name] = f'removed {hw}x{hh} using strip {sw}x{sh} at {sx},{sy}'

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')

    for name, note in sorted(report.items()):
        print(f'  {name}: {note}')
    print(f"cleared {sum(v.startswith('removed') for v in report.values())} of {len(report)}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
