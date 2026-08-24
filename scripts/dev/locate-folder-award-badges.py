"""Find the fabricated "Pioneer" award badges on the package folders.

The badges differ in wording between folders and one is a blank ribbon, so
matching them against a single example does not generalise. What they all share
is a three-part colour signature in one small area: a saturated red ribbon bar,
a row of gold stars, and a pale ring drawn around both. Sliced picanha has the
red but never the stars or the ring, which is what separates the two.

Emits JSON on stdout: {filename: [{x, y, w, h, stars, ring}, ...]}.
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FOLDERS = os.path.join(ROOT, 'assets', 'packages', 'folders-v2', '*.webp')
MARKS = os.path.join(ROOT, 'assets', 'packages', 'folder-badge-locations.json')


def masks(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    red = (((h <= 8) | (h >= 172)) & (s >= 125) & (v >= 75))
    gold = ((h >= 14) & (h <= 34) & (s >= 110) & (v >= 130))
    pale = ((s <= 55) & (v >= 165))
    return red.astype(np.uint8), gold.astype(np.uint8), pale.astype(np.uint8)


def main():
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)

    results = {}
    for path in sorted(glob.glob(FOLDERS)):
        name = os.path.basename(path)
        bgr = cv2.imread(path, cv2.IMREAD_COLOR)
        height, width = bgr.shape[:2]
        red, gold, pale = masks(bgr)

        # The official CDL mark is pale and ringed too; exclude it.
        spot = marks.get(name)
        if spot:
            pad = int(spot['size'] * 0.26)
            y0, y1 = max(0, spot['y'] - pad), spot['y'] + spot['size'] + pad
            x0, x1 = max(0, spot['x'] - pad), spot['x'] + spot['size'] + pad
            for m in (red, gold, pale):
                m[y0:y1, x0:x1] = 0

        bars = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((5, 21), np.uint8))
        count, _, stats, _ = cv2.connectedComponentsWithStats(bars, 8)

        found = []
        for i in range(1, count):
            x, y, w, hh, area = stats[i]
            if area < 700 or hh == 0:
                continue
            if w < width * 0.06 or w > width * 0.45 or hh > height * 0.055:
                continue
            if w / hh < 1.8 or area / float(w * hh) < 0.42:
                continue

            # A badge is a ribbon with stars above it and a ring around it.
            ry0, ry1 = max(0, y - int(hh * 3.4)), min(height, y + int(hh * 4.4))
            rx0, rx1 = max(0, x - int(w * 0.28)), min(width, x + w + int(w * 0.28))
            stars = int(gold[ry0:y, rx0:rx1].sum())
            ring = int(pale[ry0:ry1, rx0:rx1].sum())
            if stars < 120 or ring < 900:
                continue

            found.append({'x': int(rx0), 'y': int(ry0), 'w': int(rx1 - rx0),
                          'h': int(ry1 - ry0), 'stars': stars, 'ring': ring})

        results[name] = found

    json.dump(results, sys.stdout, indent=2)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
