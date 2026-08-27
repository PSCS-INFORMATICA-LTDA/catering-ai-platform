"""Remove the last fabricated "Pioneer" award badges from the package folders.

An earlier pass cleared the badges that sat beside the CDL mark. Six were
missed — five sitting elsewhere on the folder, and one whose lettering that pass
did erase, leaving a blank ribbon that still reads as an award. The collection
cannot ship with some folders claiming an invented award and others not.

What is erased is only the badge's ink — its ring, ribbon, stars and lettering.
The disc behind those is already the folder's black backdrop, so masking the
strokes rather than the whole badge keeps the hole thin, and thin holes are the
one case diffusion inpainting handles without smearing. The repaired pixels are
then settled down to the brightness of what surrounds them, which takes out the
grey haze inpainting leaves behind.

Approaches that were tried and rejected, in case this needs revisiting:

  - copying a clean strip of backdrop from elsewhere dragged in lettering and
    meat icons, because very little of these folders is actually empty;
  - patch-based synthesis (xphoto SHIFTMAP) reconstructed the backdrop well but
    also cloned a second CDL logo and fragments of body copy into the hole;
  - solving a smooth colour field over the whole badge left a pale blob, since
    the badge sits against food on three of the four folders.

The official CDL mark is masked out of the repair so it can never be redrawn.

Second step of the V3 art pass; run after fix-pt-folder-sides-label.py has
seeded folders-v3.

Run: python3 scripts/dev/remove-folder-award-badges.py [--dry-run]
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
REPORT = os.path.join(PACKAGES, 'folder-award-removal.json')

# Search windows around each remaining badge, from
# locate-folder-award-badges.py and confirmed by eye.
TARGETS = {
    'bbqpri-es-v3.webp': (30, 1370, 250, 170),
    'bbqpri-pt-v3.webp': (0, 1150, 360, 330),
    'bbqsel-en-v3.webp': (240, 900, 210, 180),
    'bbqsel-plus-pt-v3.webp': (200, 800, 260, 200),
    'bbqsel-pt-v3.webp': (265, 850, 260, 190),
    'bbqtrad-pt-v3.webp': (220, 1180, 400, 300),
}


def ink_masks(roi):
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    red = (((h <= 8) | (h >= 172)) & (s >= 110) & (v >= 60))
    pale = ((s <= 70) & (v >= 140))
    gold = ((h >= 13) & (h <= 36) & (s >= 100) & (v >= 120))
    return red, (red | pale | gold).astype(np.uint8)


def ring_as_bar(roi):
    """Locate the badge by its white ring, returned in the same shape as a bar."""
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    s, v = hsv[:, :, 1], hsv[:, :, 2]
    pale = cv2.morphologyEx(((s <= 70) & (v >= 150)).astype(np.uint8),
                            cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    count, _, stats, _ = cv2.connectedComponentsWithStats(pale, 8)
    best = None
    for i in range(1, count):
        x, y, w, h, area = (int(z) for z in stats[i])
        if area < 900 or w < 60 or h < 60:
            continue
        if not 0.7 <= w / h <= 1.45:
            continue
        if best is None or area > best[0]:
            best = (area, x, y, w, h)
    if best is None:
        return None
    _, x, y, w, h = best
    # Report the ring as if it were the ribbon across its middle.
    return (w * h, x, y + h // 2 - h // 12, w, max(6, h // 6))


def badge_masks(image, window, mark):
    """The badge's strokes, and the disc they sit in."""
    height, width = image.shape[:2]
    sx, sy, sw, sh = window
    x0, y0 = max(0, sx), max(0, sy)
    x1, y1 = min(width, sx + sw), min(height, sy + sh)
    roi = image[y0:y1, x0:x1]

    red, ink = ink_masks(roi)
    bars = cv2.morphologyEx(red.astype(np.uint8), cv2.MORPH_CLOSE,
                            np.ones((5, 17), np.uint8))
    count, _, stats, _ = cv2.connectedComponentsWithStats(bars, 8)
    bar = None
    for i in range(1, count):
        x, y, w, h, area = (int(z) for z in stats[i])
        if area < 500 or h == 0 or w / h < 1.8:
            continue
        if bar is None or area > bar[0]:
            bar = (area, x, y, w, h)
    if bar is None:
        # On one folder the ribbon is fused with a red background wash, so it
        # never reads as a bar. The white ring around the disc still does.
        bar = ring_as_bar(roi)
    if bar is None:
        return None, None

    _, rx, ry, rw, rh = bar
    # Confining the mask to the disc and its ribbon matters: body copy sits
    # right beside these badges and shares their colour.
    disc = np.zeros(ink.shape, np.uint8)
    cv2.ellipse(disc, (rx + rw // 2, ry + rh // 2),
                (int(rw * 0.53), int(rw * 0.57)), 0, 0, 360, 255, -1)
    # The ribbon's folded ends stick out past the disc on both sides.
    wing = int(rw * 0.16)
    cv2.rectangle(disc, (rx - wing, ry - 4), (rx + rw + wing, ry + rh + 4), 255, -1)

    strokes = cv2.dilate((ink & (disc > 0)).astype(np.uint8) * 255,
                         np.ones((5, 5), np.uint8))

    full = np.zeros((height, width), np.uint8)
    region = np.zeros((height, width), np.uint8)
    full[y0:y1, x0:x1] = strokes
    region[y0:y1, x0:x1] = disc

    if mark:
        pad = int(mark['size'] * 0.05)
        for layer in (full, region):
            cv2.rectangle(
                layer,
                (max(0, mark['x'] - pad), max(0, mark['y'] - pad)),
                (mark['x'] + mark['size'] + pad, mark['y'] + mark['size'] + pad),
                0, -1,
            )
    return full, region


def settle(original, repaired, strokes, region):
    """Bring the repair down to the brightness of its surroundings."""
    ring = cv2.dilate(region, np.ones((37, 37), np.uint8)) - region
    if not ring.any():
        return repaired
    grey_src = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    ceiling = float(np.percentile(grey_src[ring > 0], 72))
    backdrop = np.percentile(original[ring > 0].reshape(-1, 3), 50, axis=0)

    grey = cv2.cvtColor(repaired, cv2.COLOR_BGR2GRAY).astype(np.float32)
    over = np.clip((grey - ceiling) / max(1.0, float(grey.max()) - ceiling), 0, 1)
    soft = cv2.GaussianBlur((strokes > 0).astype(np.float32), (0, 0), 6)
    weight = (over * soft)[:, :, None]
    blended = repaired.astype(np.float32) * (1 - weight) + backdrop[None, None, :] * weight
    return np.clip(blended, 0, 255).astype(np.uint8)


def main():
    dry = '--dry-run' in sys.argv
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)

    report = {}
    for name, window in sorted(TARGETS.items()):
        path = os.path.join(FOLDERS, name)
        image = cv2.imread(path, cv2.IMREAD_COLOR)
        strokes, region = badge_masks(
            image, window, marks.get(name.replace('-v3.', '-v2.'))
        )
        if strokes is None:
            report[name] = 'no badge found in the expected place'
            continue

        repaired = settle(image, cv2.inpaint(image, strokes, 4, cv2.INPAINT_TELEA),
                          strokes, region)
        if not dry:
            cv2.imwrite(path, repaired, [cv2.IMWRITE_WEBP_QUALITY, 92])
        report[name] = f'removed, {int((strokes > 0).sum())} px of badge ink'

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')

    for name, note in sorted(report.items()):
        print(f'  {name}: {note}')
    print(f"cleared {sum('removed' in v for v in report.values())} of {len(report)}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
