"""Score leftover award plates / black squares immediately right of the CDL mark.

Does not write artwork. Prints a ranked audit of the V3 masters.
"""
import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
MARKS = os.path.join(PACKAGES, 'folder-badge-locations.json')
OUT = '/tmp/folder-audit/v3-right'


def red_mask(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    return (((h <= 8) | (h >= 172)) & (s >= 130) & (v >= 70)).astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)

    rows = []
    for name in sorted(os.listdir(FOLDERS)):
        if not name.endswith('-v3.webp'):
            continue
        image = cv2.imread(os.path.join(FOLDERS, name))
        key = name.replace('-v3.webp', '-v2.webp')
        mark = marks.get(key)
        if image is None:
            rows.append((name, None, 'missing'))
            continue
        if not mark or mark.get('score', 0) < 0.12:
            rows.append((name, mark, 'skip-bad-mark'))
            # still dump a default crop
            h, w = image.shape[:2]
            crop = image[int(h * 0.55):int(h * 0.92), 0:int(w * 0.55)]
            cv2.imwrite(os.path.join(OUT, name.replace('.webp', '.jpg')), crop)
            continue

        x, y, s = mark['x'], mark['y'], mark['size']
        cx, cy = x + s // 2, y + s // 2
        radius = int(s * 0.52)
        # Tight strip immediately to the right of the badge, not the badge itself.
        x0 = min(image.shape[1] - 8, x + int(s * 0.92))
        x1 = min(image.shape[1], x + int(s * 2.15))
        y0 = max(0, y - int(s * 0.12))
        y1 = min(image.shape[0], y + int(s * 1.12))
        zone = image[y0:y1, x0:x1]
        cv2.imwrite(os.path.join(OUT, name.replace('.webp', '.jpg')), zone)
        if zone.size == 0:
            rows.append((name, mark, 'empty-zone'))
            continue

        gray = cv2.cvtColor(zone, cv2.COLOR_BGR2GRAY)
        lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
        dark_flat = (gray < 28) & (lap < 5.5)
        # exclude leftover circular logo if it bleeds into the strip
        yy, xx = np.ogrid[: zone.shape[0], : zone.shape[1]]
        in_logo = (xx + x0 - cx) ** 2 + (yy + y0 - cy) ** 2 <= (radius + 4) ** 2
        dark_flat = dark_flat & ~in_logo
        red = red_mask(zone).astype(bool) & ~in_logo
        dark_ratio = float(dark_flat.mean())
        red_ratio = float(red.mean())
        # compactness of the dark cluster
        ys, xs = np.where(dark_flat)
        if len(xs) > 40:
            bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
            fill = len(xs) / float(bw * bh)
        else:
            fill = 0.0
        # yellowish X on a dark plate (watermark remnant)
        b, g, r = cv2.split(zone)
        yellow = ((r > 140) & (g > 120) & (b < 90) & (np.abs(r.astype(int) - g.astype(int)) < 40))
        yellow_ratio = float((yellow & ~in_logo).mean())
        score = dark_ratio * 2.4 + red_ratio * 3.2 + yellow_ratio * 4.0 + fill * 0.4
        rows.append(
            (
                name,
                mark,
                {
                    'dark': round(dark_ratio, 4),
                    'red': round(red_ratio, 4),
                    'yellow': round(yellow_ratio, 4),
                    'fill': round(fill, 3),
                    'score': round(score, 3),
                    'box': [x0, y0, x1 - x0, y1 - y0],
                },
            )
        )

    print(f'{"file":32s} {"score":>6} {"dark":>7} {"red":>7} {"yel":>7} {"fill":>6}')
    scored = [r for r in rows if isinstance(r[2], dict)]
    scored.sort(key=lambda r: -r[2]['score'])
    for name, _mark, info in scored:
        print(
            f'{name:32s} {info["score"]:6.3f} {info["dark"]:7.4f} '
            f'{info["red"]:7.4f} {info["yellow"]:7.4f} {info["fill"]:6.3f}'
        )
    for name, _mark, info in rows:
        if not isinstance(info, dict):
            print(f'{name:32s} {info}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
