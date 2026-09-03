"""Relabel the PT folders: the rice/beans/vinaigrette tray section is GUARNIÇÕES.

Three PT folders head that tray section "ACOMPANHAMENTOS", which is the wrong
word: those are guarnições, a paid upgrade. Acompanhamentos are the chimichurri,
farofa, mel and so on that come with every package at no cost. Using one word
for both is the confusion the whole step exists to clear up, so the artwork has
to agree with it.

Only the heading is touched. The word is lifted off its background using a clean
strip of the folder's own texture and reset at the same size, colour, baseline
and left margin, so the composition does not move.

This is the first step of the V3 art pass: it seeds folders-v3 from the approved
folders-v2 and edits the copies, leaving V2 on disk and in the bucket to roll
back to.

EN and ES already say SIDE DISHES / GUARNICIONES and are left alone.

Run: python3 scripts/dev/fix-pt-folder-sides-label.py [--dry-run]
"""
import glob
import json
import os
import shutil
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SOURCE = os.path.join(ROOT, 'assets', 'packages', 'folders-v2')
FOLDERS = os.path.join(ROOT, 'assets', 'packages', 'folders-v3')
REPORT = os.path.join(ROOT, 'assets', 'packages', 'folder-pt-label-fix.json')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

WRONG = 'ACOMPANHAMENTOS'
RIGHT = 'GUARNIÇÕES'

# The art sets these headings in a condensed grotesque; DejaVu squeezed to this
# ratio is the closest match available and reads as the same family at size.
CONDENSE = 0.74
TRACKING = 0.085  # of cap height, matching the surrounding labels


def find_label(bgr, rgb):
    """The wide section heading over the tray photography.

    Most folders set it in gold, a few in white, so both are searched and each
    candidate is read before being accepted — the bullet list above it has the
    same colour and shape and would otherwise win on size alone.
    """
    import pytesseract

    height, width = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    inks = {
        'gold': (((h >= 15) & (h <= 40)) & (s >= 90) & (v >= 120)),
        'pale': ((s <= 70) & (v >= 170)),
    }

    for ink in inks.values():
        mask = cv2.morphologyEx(
            ink.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 29), np.uint8)
        )
        count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
        blobs = []
        for i in range(1, count):
            x, y, w, hh, area = (int(z) for z in stats[i])
            if area < 500 or w < width * 0.12 or hh < 12 or hh > height * 0.05:
                continue
            if w / hh < 3.0:
                continue
            blobs.append((area, x, y, w, hh))
        for _, x, y, w, hh in sorted(blobs, reverse=True):
            crop = rgb.crop((max(0, x - 8), max(0, y - 8), x + w + 8, y + hh + 8))
            big = crop.resize((crop.width * 4, crop.height * 4), Image.LANCZOS)
            reading = pytesseract.image_to_string(big, config='--psm 7').strip().upper()
            if WRONG in reading:
                return (x, y, w, hh, reading)
    return None


def ink_colour(rgb, box):
    """Average of the brightest pixels in the heading, whatever colour it is."""
    x, y, w, h = box
    patch = np.asarray(rgb.crop((x, y, x + w, y + h))).reshape(-1, 3)
    lum = patch.astype(int).sum(axis=1)
    keep = patch[lum >= np.percentile(lum, 82)]
    return tuple(int(c) for c in keep.mean(axis=0))


def donor_strip(bgr, box, pad):
    """A clean, dark, same-sized strip from just above or below the heading."""
    x, y, w, h = box
    height = bgr.shape[0]
    bx0, by0 = max(0, x - pad), max(0, y - pad)
    bw, bh = min(bgr.shape[1], x + w + pad) - bx0, min(height, y + h + pad) - by0
    best = None
    for offset in range(int(bh * 1.15), int(bh * 6), 6):
        for direction in (-1, 1):
            cy = by0 + direction * offset
            if cy < 0 or cy + bh > height:
                continue
            patch = bgr[cy:cy + bh, bx0:bx0 + bw]
            if patch.shape[:2] != (bh, bw):
                continue
            grey = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(cv2.GaussianBlur(grey, (3, 3), 0), 60, 160)
            mean, edge = float(grey.mean()), float((edges > 0).mean())
            if mean > 86 or edge > 0.05:
                continue
            score = edge + mean / 4000.0
            if best is None or score < best[0]:
                best = (score, bx0, cy, bw, bh)
    return best


def render_word(word, cap_height, colour):
    """Condensed, tracked, uppercase — the folder's heading style."""
    scale = 6
    size = int(cap_height * scale * 1.34)
    font = ImageFont.truetype(FONT, size)
    track = int(cap_height * scale * TRACKING)
    widths = [font.getbbox(ch)[2] - font.getbbox(ch)[0] for ch in word]
    total = sum(widths) + track * (len(word) - 1) + size
    canvas = Image.new('RGBA', (total, int(size * 2)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    pen = 0
    for ch in word:
        draw.text((pen, 0), ch, font=font, fill=(*colour, 255))
        pen += (font.getbbox(ch)[2] - font.getbbox(ch)[0]) + track
    canvas = canvas.crop(canvas.getbbox())
    target_h = cap_height
    target_w = max(1, int(canvas.width * (target_h / canvas.height) * CONDENSE))
    return canvas.resize((target_w, target_h), Image.LANCZOS)


def seed_v3():
    """Start V3 as a byte copy of the approved V2 art."""
    os.makedirs(FOLDERS, exist_ok=True)
    for src in sorted(glob.glob(os.path.join(SOURCE, '*-v2.webp'))):
        dst = os.path.join(
            FOLDERS, os.path.basename(src).replace('-v2.webp', '-v3.webp')
        )
        shutil.copyfile(src, dst)


def main():
    dry = '--dry-run' in sys.argv
    seed_v3()
    report = {}

    for path in sorted(glob.glob(os.path.join(FOLDERS, '*-pt-v3.webp'))):
        name = os.path.basename(path)
        bgr = cv2.imread(path, cv2.IMREAD_COLOR)
        rgb = Image.open(path).convert('RGB')
        box = find_label(bgr, rgb)
        if not box:
            report[name] = f'no "{WRONG}" heading on this folder'
            continue

        x, y, w, h, _reading = box

        pad = 10
        donor = donor_strip(bgr, (x, y, w, h), pad)
        if donor is None:
            report[name] = 'kept: no clean texture to lift the word off'
            continue

        _, dx, dy, dw, dh = donor
        colour = ink_colour(rgb, (x, y, w, h))

        from PIL import ImageFilter

        out = rgb.copy()
        patch = rgb.crop((dx, dy, dx + dw, dy + dh))
        # Opaque over the whole heading, feathered only at the very edge: an
        # inset mask leaves a rim of the old letters showing through.
        mask = Image.new('L', (dw, dh), 255)
        ImageDraw.Draw(mask).rectangle([0, 0, dw - 1, dh - 1], outline=0, width=2)
        mask = mask.filter(ImageFilter.GaussianBlur(1.6))
        out.paste(patch, (max(0, x - pad), max(0, y - pad)), mask)

        # The tail of the old word runs past the new one, so check there that
        # nothing bright survived before committing the file.
        cleared = np.asarray(out)[y:y + h, x + int(w * 0.62):x + w]
        if cleared.size and float(cleared.max()) > 205:
            report[name] = 'kept: old heading still shows through the repair'
            continue

        word = render_word(RIGHT, h, colour)
        out.paste(word, (x, y), word)
        if not dry:
            out.save(path, 'WEBP', quality=92, method=5)


        report[name] = (
            f'{WRONG} -> {RIGHT} at {x},{y} ({w}x{h}) '
            f'colour rgb{colour}'
        )

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write('\n')

    fixed = [k for k, v in report.items() if '->' in v]
    print(f'relabelled {len(fixed)} PT folder(s)')
    for name, note in sorted(report.items()):
        print(f'  {name}: {note}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
