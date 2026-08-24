"""Remove the fabricated "Pioneer in Orlando" award badges from the folders.

These came out of image generation, not the brand: there is no such asset in the
project, the wording differs between folders, and one is a blank red ribbon with
no text. They also assert an award nothing backs up, so they are removed rather
than restyled.

The repair copies a clean patch of the folder's own dark editorial texture over
the badge, which keeps the grain native. Smearing filters were tried first and
destroyed the neighbouring photography, so this refuses to touch any badge whose
box is not sitting on plain dark background, and refuses if no clean donor patch
of the right size exists. Those folders are reported instead of degraded.

Run: python3 scripts/dev/remove-folder-pioneer-marks.py [--dry-run]
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FOLDERS = os.path.join(ROOT, 'assets', 'packages', 'folders-v2')
LOCATIONS = os.path.join(ROOT, 'assets', 'packages', 'folder-badge-locations.json')
REPORT = os.path.join(ROOT, 'assets', 'packages', 'folder-pioneer-removal.json')

REACH = 2.9        # how far right of the CDL mark the badge can sit, in mark widths
PLAIN_V = 92       # a patch this dark on average counts as background
PLAIN_EDGE = 0.055 # and this smooth


def red_ribbon(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    return ((((h <= 8) | (h >= 172)) & (s >= 120) & (v >= 70))).astype(np.uint8)


def plainness(bgr):
    """Mean brightness and edge density — low, low means empty background."""
    grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(grey, (3, 3), 0), 60, 160)
    return float(grey.mean()), float((edges > 0).mean())


def find_donor(image, box, avoid):
    """A clean, dark, same-sized patch from elsewhere in the left editorial band."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    height, width = image.shape[:2]
    best = None
    for cy in range(int(height * 0.06), int(height * 0.94) - h, 12):
        for cx in range(int(width * 0.02), int(width * 0.55) - w, 12):
            if not (cx + w < avoid[0] or cx > avoid[2] or cy + h < avoid[1] or cy > avoid[3]):
                continue
            patch = image[cy:cy + h, cx:cx + w]
            if patch.shape[0] != h or patch.shape[1] != w:
                continue
            mean, edge = plainness(patch)
            if mean > PLAIN_V or edge > PLAIN_EDGE:
                continue
            score = edge + mean / 4000.0
            if best is None or score < best[0]:
                best = (score, cx, cy)
    return best


def feather(shape, border):
    mask = np.zeros(shape, np.float32)
    mask[border:-border, border:-border] = 1.0
    return cv2.GaussianBlur(mask, (0, 0), border / 2.0)[:, :, None]


def main():
    dry = '--dry-run' in sys.argv
    with open(LOCATIONS, encoding='utf-8') as fh:
        spots = json.load(fh)

    report = {}
    for path in sorted(glob.glob(os.path.join(FOLDERS, '*.webp'))):
        name = os.path.basename(path)
        spot = spots.get(name)
        image = cv2.imread(path, cv2.IMREAD_COLOR)
        height, width = image.shape[:2]

        if not spot:
            report[name] = 'skipped: no mark location'
            continue

        size = spot['size']
        sx0 = min(width, spot['x'] + int(size * 0.92))
        sx1 = min(width, spot['x'] + int(size * REACH))
        sy0 = max(0, spot['y'] - int(size * 0.25))
        sy1 = min(height, spot['y'] + int(size * 1.25))
        if sx1 - sx0 < 24 or sy1 - sy0 < 24:
            report[name] = 'skipped: no room beside the mark'
            continue

        ribbon = red_ribbon(image[sy0:sy1, sx0:sx1])
        if int(ribbon.sum()) < 400:
            report[name] = 'no award badge found'
            continue

        # The ribbon is only the middle of the badge; the oval outline, the
        # stars and the year sit around it. Grow out from the ribbon to collect
        # them, but only within a short radius, so the box cannot walk off into
        # neighbouring photography.
        # Take the ribbon's own box and grow it by its own height. The oval, the
        # stars and the year all sit within roughly that much of the ribbon, and
        # growing by a measured amount keeps the box from wandering into the
        # photography the way a colour-based grow does.
        stats = cv2.connectedComponentsWithStats(ribbon, 8)[2]
        wide = [
            i for i in range(1, len(stats))
            if stats[i, cv2.CC_STAT_WIDTH] >= size * 0.35
            and stats[i, cv2.CC_STAT_WIDTH] > stats[i, cv2.CC_STAT_HEIGHT]
        ]
        if not wide:
            report[name] = 'no award badge found'
            continue
        band = max(wide, key=lambda i: stats[i, cv2.CC_STAT_AREA])
        bx = int(stats[band, cv2.CC_STAT_LEFT])
        by = int(stats[band, cv2.CC_STAT_TOP])
        bw = int(stats[band, cv2.CC_STAT_WIDTH])
        bh = int(stats[band, cv2.CC_STAT_HEIGHT])

        grow_x = int(bw * 0.13)
        grow_y = int(max(bh * 1.9, size * 0.30))
        x0 = max(0, sx0 + bx - grow_x)
        x1 = min(width, sx0 + bx + bw + grow_x)
        y0 = max(0, sy0 + by - grow_y)
        y1 = min(height, sy0 + by + bh + grow_y)

        # The box must be sitting on dark background, or a copied patch shows.
        mean, _ = plainness(image[y0:y1, x0:x1])
        if mean > 108:
            report[name] = f'kept: badge sits on photography (mean {mean:.0f})'
            continue

        donor = find_donor(image, (x0, y0, x1, y1), (x0 - 24, y0 - 24, x1 + 24, y1 + 24))
        if donor is None:
            report[name] = 'kept: no clean donor texture available'
            continue

        _, dx, dy = donor
        if not dry:
            border = 6
            patch = image[dy:dy + (y1 - y0), dx:dx + (x1 - x0)].astype(np.float32)
            target = image[y0:y1, x0:x1].astype(np.float32)
            alpha = feather(patch.shape[:2], border)
            image[y0:y1, x0:x1] = (patch * alpha + target * (1 - alpha)).astype(np.uint8)
            cv2.imwrite(path, image, [cv2.IMWRITE_WEBP_QUALITY, 92])

        report[name] = f'removed {x1 - x0}x{y1 - y0} using donor at {dx},{dy}'

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')

    removed = sum(1 for v in report.values() if v.startswith('removed'))
    kept = sorted(n for n, v in report.items() if v.startswith('kept'))
    print(f'award badge removed from {removed} of {len(report)} folders')
    for name, note in sorted(report.items()):
        if not note.startswith('removed'):
            print(f'  {name}: {note}')
    if kept:
        print(f'\n{len(kept)} folder(s) need manual edit rather than a degraded repair')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
