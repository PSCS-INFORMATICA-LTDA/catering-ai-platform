"""Clean leftover award plates on V3 folders using verified wood donors.

The donor strips are real table wood photographed on the flyers themselves.
Each hole is colour-matched to the local grain, tiled, and feathered. The
official CDL mark, food and labels stay untouched.

Writes *-v4.webp beside the V3 masters so rollback is the old filename.

Run: python3 scripts/dev/clean-folder-artifacts-v4.py [--dry-run]
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
DONOR_COOL = os.path.join(PACKAGES, 'folder-wood-donor.webp')
DONOR_WARM = os.path.join(PACKAGES, 'folder-wood-donor-warm.webp')
REPORT = os.path.join(PACKAGES, 'folder-artifact-cleanup-v4.json')

SKIP = {
    # Food label sits in the award strip; filling it would smear "Arroz Branco".
    'bbqcho-plus-pt-v3.webp',
}

PERS_HOLES = {
    'bbqpers-plus-pt-v3.webp': (204, 1306, 300, 226),
    'bbqpers-plus-en-v3.webp': (176, 1354, 280, 176),
    'bbqpers-plus-es-v3.webp': (186, 1340, 286, 188),
    'bbqpers-pt-v3.webp': (230, 1322, 270, 168),
    'bbqpers-en-v3.webp': (216, 1330, 270, 164),
    'bbqpers-es-v3.webp': (230, 1304, 286, 184),
}

MARK_OVERRIDES = {
    'bbqtrad-en-v3.webp': {'x': 46, 'y': 837, 'size': 186, 'score': 0.74},
}


def red_mask(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    return (((h <= 8) | (h >= 172)) & (s >= 125) & (v >= 60)).astype(np.uint8)


def protect_logo(shape, mark, pad=5):
    mask = np.zeros(shape[:2], np.uint8)
    cx = mark['x'] + mark['size'] // 2
    cy = mark['y'] + mark['size'] // 2
    cv2.circle(mask, (cx, cy), int(mark['size'] * 0.52) + pad, 255, -1)
    return mask


def find_text_cards(image, box):
    x0, y0, x1, y1 = [max(0, v) for v in box[:2]] + list(box[2:])
    x1 = min(image.shape[1], x1)
    y1 = min(image.shape[0], y1)
    roi = image[y0:y1, x0:x1]
    cards = []
    if roi.size == 0:
        return cards
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    dark = cv2.morphologyEx((gray < 48).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    bright = (gray > 145).astype(np.uint8)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    for i in range(1, num):
        area = stats[i, cv2.CC_STAT_AREA]
        bw, bh = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
        if area < 350 or bw < 36 or bh < 22:
            continue
        if bright[labels == i].mean() < 0.03:
            continue
        cards.append(
            (
                x0 + stats[i, cv2.CC_STAT_LEFT],
                y0 + stats[i, cv2.CC_STAT_TOP],
                bw,
                bh,
            )
        )
    return cards


def overlaps(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw <= bx or bx + bw <= ax or ay + ah <= by or by + bh <= ay)


def award_hole(mark, image):
    x, y, s = mark['x'], mark['y'], mark['size']
    hx = x + int(s * 0.88)
    hy = y + int(s * 0.08)
    hw = int(s * 1.02)
    hh = int(s * 0.86)
    hx = max(0, min(hx, image.shape[1] - 8))
    hy = max(0, min(hy, image.shape[0] - 8))
    hw = min(hw, image.shape[1] - hx)
    hh = min(hh, image.shape[0] - hy)
    cards = find_text_cards(
        image,
        (hx, max(0, hy - 16), hx + hw + 90, hy + hh + 16),
    )
    for card in cards:
        while hw > 28 and overlaps((hx, hy, hw, hh), card):
            hw -= 4
    if hw < 32 or hh < 32:
        return None
    return hx, hy, hw, hh


def local_wood_sample(image, box, logo):
    x, y, w, h = box
    probes = [
        (x, min(image.shape[0] - 36, y + h + 6), min(160, w), 32),
        (max(0, x - 170), y + h // 3, 150, 32),
        (x, max(0, y - 38), min(160, w), 32),
    ]
    for px, py, pw, ph in probes:
        pw = min(pw, image.shape[1] - px)
        ph = min(ph, image.shape[0] - py)
        if pw < 24 or ph < 16:
            continue
        patch = image[py:py + ph, px:px + pw]
        if logo[py:py + ph, px:px + pw].mean() > 20:
            continue
        gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
        if gray.mean() < 10 or gray.mean() > 85:
            continue
        if red_mask(patch).mean() > 0.03:
            continue
        if (gray > 160).mean() > 0.05:
            continue
        return patch
    return None


def match_color(src, ref):
    out = src.astype(np.float32)
    for c in range(3):
        s_mean, s_std = float(src[:, :, c].mean()), float(src[:, :, c].std()) + 1e-6
        r_mean, r_std = float(ref[:, :, c].mean()), float(ref[:, :, c].std()) + 1e-6
        out[:, :, c] = (out[:, :, c] - s_mean) / s_std * r_std + r_mean
    return np.clip(out, 0, 255).astype(np.uint8)


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


def wood_fill(image, box, logo, donor):
    x, y, w, h = box
    x = max(0, x)
    y = max(0, y)
    w = min(w, image.shape[1] - x)
    h = min(h, image.shape[0] - y)
    if w < 16 or h < 16:
        return image, 0
    sample = local_wood_sample(image, box, logo)
    strip = match_color(donor, sample) if sample is not None else donor
    pad = 22
    ex = max(0, x - pad)
    ey = max(0, y - pad)
    ew = min(image.shape[1] - ex, w + pad * 2)
    eh = min(image.shape[0] - ey, h + pad * 2)
    fill = tile_strip(strip, ew, eh)
    alpha = np.zeros((eh, ew), np.float32)
    ix, iy = x - ex, y - ey
    alpha[iy:iy + h, ix:ix + w] = 1.0
    alpha = np.clip(cv2.GaussianBlur(alpha, (0, 0), 7.2), 0, 1)
    alpha[logo[ey:ey + eh, ex:ex + ew] > 0] = 0
    out = image.copy()
    target = image[ey:ey + eh, ex:ex + ew].astype(np.float32)
    out[ey:ey + eh, ex:ex + ew] = np.clip(
        fill.astype(np.float32) * alpha[:, :, None] + target * (1.0 - alpha[:, :, None]),
        0,
        255,
    ).astype(np.uint8)
    return out, int(alpha.sum())


def leftover_red(image, mark, hole):
    height, width = image.shape[:2]
    x, y, s = mark['x'], mark['y'], mark['size']
    x0 = min(width - 2, x + int(s * 0.84))
    x1 = min(width, (hole[0] + hole[2] + int(s * 0.18)) if hole else x + int(s * 1.4))
    y0 = max(0, y - int(s * 0.04))
    y1 = min(height, y + int(s * 1.06))
    zone = np.zeros((height, width), np.uint8)
    zone[y0:y1, x0:x1] = red_mask(image[y0:y1, x0:x1])
    zone[protect_logo(image.shape, mark, pad=6) > 0] = 0
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(zone, 8)
    keep = np.zeros_like(zone)
    for i in range(1, num):
        area = stats[i, cv2.CC_STAT_AREA]
        cx = centroids[i][0]
        if area < 10:
            continue
        if cx > x + s * 1.38 and 90 < area < 2600:
            continue
        keep[labels == i] = 1
    return cv2.dilate(keep, np.ones((3, 3), np.uint8), 1)


def load_source(name):
    backup = os.path.join(BACKUP, name)
    current = os.path.join(FOLDERS, name)
    if name.startswith('bbqpers-') and os.path.exists(backup):
        return cv2.imread(backup, cv2.IMREAD_COLOR)
    return cv2.imread(current, cv2.IMREAD_COLOR)


def main():
    dry = '--dry-run' in sys.argv
    with open(MARKS, encoding='utf-8') as fh:
        marks = json.load(fh)
    cool = cv2.imread(DONOR_COOL, cv2.IMREAD_COLOR)
    warm = cv2.imread(DONOR_WARM, cv2.IMREAD_COLOR)
    if cool is None or warm is None:
        print('missing wood donor', file=sys.stderr)
        return 1

    report = {}
    for name in sorted(os.listdir(FOLDERS)):
        if not name.endswith('-v3.webp'):
            continue
        if name in SKIP:
            report[name] = {'status': 'skipped-clean'}
            continue
        image = load_source(name)
        if image is None:
            report[name] = {'status': 'missing'}
            continue
        key = name.replace('-v3.webp', '-v2.webp')
        mark = MARK_OVERRIDES.get(name) or marks.get(key)
        if not mark or (mark.get('score', 1) < 0.12 and name not in MARK_OVERRIDES):
            report[name] = {'status': 'skipped-bad-mark'}
            continue

        work = image.copy()
        reasons = []
        logo = protect_logo(image.shape, mark, pad=5)
        donor = warm if name.startswith('bbqpers-') else cool

        if name in PERS_HOLES:
            work, px = wood_fill(work, PERS_HOLES[name], logo, donor)
            if px > 80:
                reasons.append(f'pers-plate px={px}')

        hole = award_hole(mark, work)
        if hole:
            work, px = wood_fill(work, hole, logo, donor)
            if px > 80:
                reasons.append(f'award-hole {hole[2]}x{hole[3]} px={px}')

        red = leftover_red(work, mark, hole)
        if 30 < int(red.sum()) < 1800:
            painted = cv2.inpaint(work, red, 3, cv2.INPAINT_TELEA)
            work = np.where((logo > 0)[:, :, None], image, painted)
            reasons.append(f'red-inpaint {int(red.sum())}')

        if reasons:
            dest = name.replace('-v3.webp', '-v4.webp')
            if not dry:
                cv2.imwrite(os.path.join(FOLDERS, dest), work, [cv2.IMWRITE_WEBP_QUALITY, 92])
            report[name] = {'status': 'cleaned', 'dest': dest, 'reasons': reasons, 'hole': hole}
        else:
            report[name] = {'status': 'clean', 'hole': hole}

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    cleaned = sum(1 for v in report.values() if v.get('status') == 'cleaned')
    print(f'cleaned {cleaned} of {len(report)}')
    for name, note in sorted(report.items()):
        print(f'  {name}: {note}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
