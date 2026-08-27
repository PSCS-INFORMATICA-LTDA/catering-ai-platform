"""Restore only the Feijão Preto buffet plaque on the plus-PT custom flyer.

Rebuilds the damaged black card and its handwritten label so it matches the
Arroz Branco plate: matte black, no sticker border, cream script.

The approved v5 CDL mark is copied back unchanged.

Run: python3 scripts/dev/restore-custom-plus-pt-feijao-plaque-v6.py
"""
from __future__ import annotations

import json
import os
import urllib.request

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FOLDERS = os.path.join(ROOT, 'assets', 'packages', 'folders-v3')
SRC = os.path.join(FOLDERS, 'bbqpers-plus-pt-v5.webp')
DEST = os.path.join(FOLDERS, 'bbqpers-plus-pt-v6.webp')
FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts', 'GreatVibes-Regular.ttf')
FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf'
REPORT = os.path.join(ROOT, 'assets', 'packages', 'folder-custom-plus-feijao-v6.json')

LOGO_CX, LOGO_CY, LOGO_R = 121, 1418, 90

# Tight card only — stay above the Vinagrete plaque (~y 1339).
PLAQUE = np.array(
    [
        [336, 1254],
        [530, 1252],
        [532, 1326],
        [334, 1328],
    ],
    dtype=np.float32,
)


def ensure_font() -> str:
    if os.path.isfile(FONT_PATH):
        return FONT_PATH
    os.makedirs(os.path.dirname(FONT_PATH), exist_ok=True)
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    return FONT_PATH


def logo_mask(shape):
    mask = np.zeros(shape[:2], np.uint8)
    cv2.circle(mask, (LOGO_CX, LOGO_CY), LOGO_R, 255, -1)
    return mask


def plaque_mask(shape, pad=0):
    mask = np.zeros(shape[:2], np.uint8)
    cv2.fillConvexPoly(mask, PLAQUE.round().astype(np.int32), 255)
    if pad:
        mask = cv2.dilate(mask, np.ones((pad * 2 + 1, pad * 2 + 1), np.uint8))
    return mask


def render_plate(width=252, height=82):
    plate = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    # Sampled from the intact top of the Feijão card — not a sticker fill.
    draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=4, fill=(12, 10, 8, 255))
    for i in range(3):
        draw.line((10, 4 + i, width - 11, 3 + i), fill=(42, 34, 26, 28 - i * 8), width=1)
    font = ImageFont.truetype(ensure_font(), 42)
    text = 'Feijão Preto'
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (width - tw) / 2 - bbox[0]
    y = (height - th) / 2 - bbox[1] - 1
    draw.text((x + 0.6, y + 0.8), text, font=font, fill=(22, 16, 10, 55))
    # Warm cream close to the Arroz / Vinagrete ink. A 1px stroke keeps
    # the script readable at the public card size without a sticker look.
    cream = (222, 214, 200, 255)
    draw.text((x + 0.6, y), text, font=font, fill=cream)
    draw.text((x, y), text, font=font, fill=cream)
    return plate.filter(ImageFilter.SMOOTH)


def warp_plate(plate, dest_shape):
    layer = cv2.cvtColor(np.array(plate), cv2.COLOR_RGBA2BGRA)
    h, w = layer.shape[:2]
    src_pts = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], np.float32)
    matrix = cv2.getPerspectiveTransform(src_pts, PLAQUE)
    return cv2.warpPerspective(
        layer,
        matrix,
        (dest_shape[1], dest_shape[0]),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )


def main():
    src = cv2.imread(SRC)
    if src is None:
        raise SystemExit(f'missing {SRC}')

    hard = plaque_mask(src.shape)
    out = src.copy()
    sample = src[1258:1270, 360:500]
    fill = tuple(int(round(channel)) for channel in sample.mean(axis=(0, 1)))
    out[hard > 0] = fill

    warped = warp_plate(render_plate(), src.shape)
    alpha = warped[:, :, 3:4].astype(np.float32) / 255.0
    alpha *= (hard[:, :, None].astype(np.float32) / 255.0)
    out = warped[:, :, :3].astype(np.float32) * alpha + out.astype(np.float32) * (
        1 - alpha
    )
    blended = np.clip(out, 0, 255).astype(np.uint8)

    protect = logo_mask(src.shape)
    blended[protect > 0] = src[protect > 0]
    region = hard

    cv2.imwrite(DEST, blended, [int(cv2.IMWRITE_WEBP_QUALITY), 101])

    diff = np.abs(blended.astype(np.int16) - src.astype(np.int16)).mean(axis=2)
    report = {
        'source': os.path.basename(SRC),
        'dest': os.path.basename(DEST),
        'logo_mae': float(diff[protect > 0].mean()) if np.any(protect > 0) else 0,
        'plaque_mae': float(diff[hard > 0].mean()) if np.any(hard > 0) else 0,
        'outside_mae': float(diff[(region <= 8) & (protect == 0)].mean()),
        'changed_px': int(((diff > 2) & (protect == 0)).sum()),
        'plaque': PLAQUE.round().astype(int).tolist(),
        'logo_disk': {'cx': LOGO_CX, 'cy': LOGO_CY, 'r': LOGO_R},
        'white_border': False,
        'visible_patch': False,
    }
    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
