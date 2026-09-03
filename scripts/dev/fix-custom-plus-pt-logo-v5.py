"""Clean the CDL mark on BBQ Personalizado com guarnições only.

The published plus-PT flyer still carries a dark smear immediately right of
the official mark. This rebuilds that wood with a soft organic mask, then
stamps the clean circular badge in the same place.

Does not touch food, labels, other locales, or any other flyer.

Writes bbqpers-plus-pt-v5.webp beside the v4 file so rollback is the old name.

Run: python3 scripts/dev/fix-custom-plus-pt-logo-v5.py [--dry-run]
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
SRC = os.path.join(FOLDERS, 'bbqpers-plus-pt-v4.webp')
DEST = os.path.join(FOLDERS, 'bbqpers-plus-pt-v5.webp')
BADGE = os.path.join(PACKAGES, 'cdl-badge-official.png')
DONOR = os.path.join(PACKAGES, 'folder-wood-donor-warm.webp')
MARKS = os.path.join(PACKAGES, 'folder-badge-locations.json')
REPORT = os.path.join(PACKAGES, 'folder-custom-plus-logo-v5.json')

# Same mark the earlier folder pipeline located on this flyer.
MARK_KEY = 'bbqpers-plus-pt-v2.webp'
COVER = 1.06


def label_protect(image):
    """Keep the Arroz Branco / Feijão Preto plaques off the fill."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    bright = (gray > 155).astype(np.uint8)
    zone = np.zeros_like(bright)
    zone[1188:1348, 48:640] = bright[1188:1348, 48:640]
    return cv2.dilate(zone, np.ones((13, 19), np.uint8), 1)


def smear_mask(image, mark):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    x, y, s = mark['x'], mark['y'], mark['size']
    cx, cy = x + s // 2, y + s // 2
    radius = int(s * 0.56)

    disk = np.zeros((height, width), np.uint8)
    cv2.circle(disk, (cx, cy), radius + 8, 255, -1)

    # The leftover plate is a flat dark field to the right of the mark.
    # Cover the whole field so the fill boundary lands on real table wood.
    mean = cv2.blur(gray.astype(np.float32), (21, 21))
    var = cv2.blur((gray.astype(np.float32) - mean) ** 2, (21, 21))
    std = np.sqrt(var)
    smear = ((gray < 22) & (std < 11)).astype(np.uint8) * 255
    plate = np.zeros_like(smear)
    plate[1324:1528, 188:468] = 255
    smear = cv2.bitwise_and(smear, plate)
    smear = cv2.morphologyEx(smear, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
    smear = cv2.dilate(smear, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))

    mask = cv2.bitwise_or(disk, smear)
    mask[label_protect(image) > 0] = 0
    mask[:1310] = 0
    return mask


def restore_wood(image, mask, donor):
    """Clone clean table wood. Never pull labels or metal into the hole."""
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blocked = label_protect(image)
    # gold legs / bright specks are not wood
    blocked = np.maximum(blocked, (gray > 70).astype(np.uint8) * 255)

    donor_y0, donor_y1 = 1448, 1526
    donor_x0, donor_x1 = 560, 980
    donor_h = donor_y1 - donor_y0
    donor_w = donor_x1 - donor_x0
    table = image[donor_y0:donor_y1, donor_x0:donor_x1]

    fill = image.copy()
    ys, xs = np.where(mask > 0)
    offset = 360
    src_x = np.clip(xs + offset, 0, width - 1)
    src_y = ys
    ok = blocked[src_y, src_x] == 0
    fill[ys[ok], xs[ok]] = image[src_y[ok], src_x[ok]]
    # rows that would copy a plaque fall back to the verified wood strip
    bad = ~ok
    if np.any(bad):
        fy = (ys[bad] - donor_y0) % donor_h
        fx = (xs[bad] - 188) % donor_w
        fill[ys[bad], xs[bad]] = table[fy, fx]

    alpha = (mask.astype(np.float32) / 255.0)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 12.0)
    alpha = np.clip(alpha, 0, 1)
    protect = label_protect(image).astype(np.float32) / 255.0
    alpha *= 1.0 - protect
    out = (
        fill.astype(np.float32) * alpha[:, :, None]
        + image.astype(np.float32) * (1.0 - alpha[:, :, None])
    )
    return np.clip(out, 0, 255).astype(np.uint8)


def stamp_badge(image, mark, badge):
    x, y, s = mark['x'], mark['y'], mark['size']
    size = int(round(s * COVER))
    shift = int(round((size - s) / 2))
    left = max(0, min(image.shape[1] - size, x - shift))
    top = max(0, min(image.shape[0] - size, y - shift))
    stamp = cv2.resize(badge, (size, size), interpolation=cv2.INTER_AREA)
    alpha = stamp[:, :, 3].astype(np.float32) / 255.0
    # keep the circle; do not stretch transparent corners into a plate
    yy, xx = np.ogrid[:size, :size]
    cx = cy = (size - 1) / 2.0
    r = size * 0.5
    circle = (((xx - cx) ** 2 + (yy - cy) ** 2) <= r * r).astype(np.float32)
    alpha = alpha * circle
    rgb = stamp[:, :, :3]
    dest = image[top : top + size, left : left + size].astype(np.float32)
    image[top : top + size, left : left + size] = np.clip(
        rgb.astype(np.float32) * alpha[:, :, None]
        + dest * (1.0 - alpha[:, :, None]),
        0,
        255,
    ).astype(np.uint8)
    return image, left, top, size


def main():
    dry = '--dry-run' in sys.argv
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)
    mark = marks[MARK_KEY]
    src = cv2.imread(SRC, cv2.IMREAD_COLOR)
    badge = cv2.imread(BADGE, cv2.IMREAD_UNCHANGED)
    donor = cv2.imread(DONOR, cv2.IMREAD_COLOR)
    if src is None or badge is None:
        print('missing source or official badge', file=sys.stderr)
        return 1

    mask = smear_mask(src, mark)
    work = restore_wood(src, mask, donor)
    work, left, top, size = stamp_badge(work, mark, badge)

    if not dry:
        cv2.imwrite(DEST, work, [cv2.IMWRITE_WEBP_QUALITY, 92])

    report = {
        'source': os.path.basename(SRC),
        'dest': os.path.basename(DEST),
        'mark': mark,
        'stamp': {'left': left, 'top': top, 'size': size},
        'mask_px': int((mask > 0).sum()),
        'outside_logo_mae': None,
    }
    # proof the food / labels outside the work mask did not move
    changed = np.abs(work.astype(np.int16) - src.astype(np.int16)).mean(axis=2)
    outside = changed[mask == 0]
    # the stamp sits inside the mask; measure the rest of the flyer
    stamp_disk = np.zeros(src.shape[:2], np.uint8)
    cv2.circle(
        stamp_disk,
        (mark['x'] + mark['size'] // 2, mark['y'] + mark['size'] // 2),
        int(size * 0.55),
        255,
        -1,
    )
    keep = (mask == 0) & (stamp_disk == 0)
    report['outside_logo_mae'] = float(changed[keep].mean())
    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
