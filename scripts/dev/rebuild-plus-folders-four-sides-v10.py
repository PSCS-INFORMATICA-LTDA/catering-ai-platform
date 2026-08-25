"""Rebuild COM GUARNIÇÕES / WITH SIDES folders with four presented pans.

Upper identity (package name, meats, hero) stays on the existing plus
masters. The lower band is replaced with Caio's four-pan food photo
(rice, black beans, Brazilian potato salad, vinaigrette) plus ALL CAPS
labels and one official CDL stamp.

Farofa and Caesar stay out of the photo. No pricing or business rules.

Run: python3 scripts/dev/rebuild-plus-folders-four-sides-v10.py
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
SIDES_DIR = os.path.join(PACKAGES, 'sides-presented-v10')
BADGE = os.path.join(PACKAGES, 'cdl-badge-official.png')
FONT = '/usr/share/fonts/truetype/macos/Inter-Bold.ttf'
PREVIEW = '/tmp/art-audit/v10'
REPORT = os.path.join(PACKAGES, 'folder-plus-four-sides-v10.json')
os.makedirs(SIDES_DIR, exist_ok=True)
os.makedirs(PREVIEW, exist_ok=True)

CAIO_CANDIDATES = [
    os.path.join(
        ROOT,
        '..',
        '.cursor',
        'projects',
        'workspace',
        'assets',
        'AF4B14B9-7DE6-4704-9627-DA51BA899DE3_L0_001.jpg',
    ),
    '/home/ubuntu/.cursor/projects/workspace/assets/AF4B14B9-7DE6-4704-9627-DA51BA899DE3_L0_001.jpg',
]
# Food-only box: two chafing dishes, four foil pans, no wooden discs / Lima marks.
CAIO_FOOD_BOX = (10, 960, 1168, 1365)
FOOD_BAND = os.path.join(SIDES_DIR, 'four-pans.webp')

LABELS = {
    'pt': ['ARROZ BRANCO', 'FEIJÃO PRETO', 'MAIONESE', 'VINAGRETE'],
    'en': ['WHITE RICE', 'BLACK BEANS', 'POTATO SALAD', 'VINAIGRETTE'],
    'es': ['ARROZ BLANCO', 'FRIJOLES NEGROS', 'ENSALADA DE PAPA', 'VINAGRETA'],
}

JOBS = [
    {'src': 'bbqpers-plus-pt-v8.webp', 'dest': 'bbqpers-plus-pt-v10.webp', 'locale': 'pt', 'y_cut': 1016, 'stamp': True},
    {'src': 'bbqpers-plus-en-v6.webp', 'dest': 'bbqpers-plus-en-v10.webp', 'locale': 'en', 'y_cut': 992, 'stamp': True},
    {'src': 'bbqpers-plus-es-v6.webp', 'dest': 'bbqpers-plus-es-v10.webp', 'locale': 'es', 'y_cut': 992, 'stamp': True},
    {'src': 'bbqtrad-plus-pt-v4.webp', 'dest': 'bbqtrad-plus-pt-v10.webp', 'locale': 'pt', 'y_cut': 1012, 'stamp': False},
    {'src': 'bbqtrad-plus-en-v4.webp', 'dest': 'bbqtrad-plus-en-v10.webp', 'locale': 'en', 'y_cut': 1012, 'stamp': False},
    {'src': 'bbqtrad-plus-es-v3.webp', 'dest': 'bbqtrad-plus-es-v10.webp', 'locale': 'es', 'y_cut': 1008, 'stamp': False},
    {'src': 'bbqsel-plus-pt-v4.webp', 'dest': 'bbqsel-plus-pt-v10.webp', 'locale': 'pt', 'y_cut': 968, 'stamp': False},
    {'src': 'bbqsel-plus-en-v3.webp', 'dest': 'bbqsel-plus-en-v10.webp', 'locale': 'en', 'y_cut': 960, 'stamp': False},
    {'src': 'bbqsel-plus-es-v3.webp', 'dest': 'bbqsel-plus-es-v10.webp', 'locale': 'es', 'y_cut': 968, 'stamp': False},
    {'src': 'bbqcho-plus-pt-v3.webp', 'dest': 'bbqcho-plus-pt-v10.webp', 'locale': 'pt', 'y_cut': 956, 'stamp': True},
    {'src': 'bbqcho-plus-en-v4.webp', 'dest': 'bbqcho-plus-en-v10.webp', 'locale': 'en', 'y_cut': 952, 'stamp': True},
    {'src': 'bbqcho-plus-es-v3.webp', 'dest': 'bbqcho-plus-es-v10.webp', 'locale': 'es', 'y_cut': 960, 'stamp': True},
    {'src': 'bbqpri-plus-pt-v4.webp', 'dest': 'bbqpri-plus-pt-v10.webp', 'locale': 'pt', 'y_cut': 928, 'stamp': True},
    {'src': 'bbqpri-plus-en-v4.webp', 'dest': 'bbqpri-plus-en-v10.webp', 'locale': 'en', 'y_cut': 932, 'stamp': True},
    {'src': 'bbqpri-plus-es-v3.webp', 'dest': 'bbqpri-plus-es-v10.webp', 'locale': 'es', 'y_cut': 932, 'stamp': True},
]


def resolve_caio() -> str | None:
    for path in CAIO_CANDIDATES:
        if os.path.isfile(path):
            return path
    return None


def extract_food_band() -> np.ndarray:
    if os.path.isfile(FOOD_BAND):
        existing = cv2.imread(FOOD_BAND, cv2.IMREAD_COLOR)
        if existing is not None and existing.size:
            return existing
    caio = resolve_caio()
    if not caio:
        raise FileNotFoundError('Caio 4-side photo and committed food band are both missing')
    photo = cv2.imread(caio, cv2.IMREAD_COLOR)
    if photo is None:
        raise FileNotFoundError(caio)
    x0, y0, x1, y1 = CAIO_FOOD_BOX
    band = photo[y0:y1, x0:x1]
    cv2.imwrite(FOOD_BAND, band, [cv2.IMWRITE_WEBP_QUALITY, 94])
    cv2.imwrite(
        os.path.join(SIDES_DIR, 'four-pans.jpg'),
        band,
        [int(cv2.IMWRITE_JPEG_QUALITY), 92],
    )
    return band


def stamp_official(
    image: np.ndarray,
    badge: np.ndarray,
    left: int,
    top: int,
    size: int,
) -> np.ndarray:
    stamp = cv2.resize(badge, (size, size), interpolation=cv2.INTER_AREA)
    raw = stamp[:, :, 3].astype(np.float32) / 255.0
    hard = np.where(raw > 0.20, 1.0, 0.0).astype(np.float32)
    yy, xx = np.ogrid[:size, :size]
    c = (size - 1) / 2.0
    circle = (((xx - c) ** 2 + (yy - c) ** 2) <= (size * 0.498) ** 2).astype(np.float32)
    alpha = np.clip(hard * circle, 0, 1)
    rgb = stamp[:, :, :3].astype(np.float32)
    dest = image[top : top + size, left : left + size].astype(np.float32)
    image = image.copy()
    image[top : top + size, left : left + size] = np.clip(
        rgb * alpha[:, :, None] + dest * (1.0 - alpha[:, :, None]),
        0,
        255,
    ).astype(np.uint8)
    return image


def wrap_label(text: str, max_width: int, font: ImageFont.FreeTypeFont, draw: ImageDraw.ImageDraw) -> list[str]:
    if draw.textbbox((0, 0), text, font=font)[2] <= max_width:
        return [text]
    parts = text.split(' ')
    if len(parts) < 2:
        return [text]
    mid = max(1, len(parts) // 2)
    return [' '.join(parts[:mid]), ' '.join(parts[mid:])]


def draw_labels(width: int, height: int, labels: list[str]) -> np.ndarray:
    card = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    col_w = width / 4
    size = 22
    font = ImageFont.truetype(FONT, size)
    cream = (246, 208, 0, 255)
    for i, text in enumerate(labels):
        lines = wrap_label(text, int(col_w - 16), font, draw)
        while True:
            too_wide = any(
                draw.textbbox((0, 0), line, font=font)[2] > col_w - 14 for line in lines
            )
            if not too_wide or size <= 14:
                break
            size -= 1
            font = ImageFont.truetype(FONT, size)
            lines = wrap_label(text, int(col_w - 16), font, draw)
        line_h = draw.textbbox((0, 0), 'Ag', font=font)[3]
        block_h = line_h * len(lines) + 2 * (len(lines) - 1)
        y = max(4, (height - block_h) // 2)
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            tw = bbox[2] - bbox[0]
            x = int(i * col_w + (col_w - tw) / 2 - bbox[0])
            draw.text((x + 1, y + 1), line, font=font, fill=(0, 0, 0, 160))
            draw.text((x, y), line, font=font, fill=cream)
            y += line_h + 2
    return cv2.cvtColor(np.array(card), cv2.COLOR_RGBA2BGRA)


def compose(base: np.ndarray, food: np.ndarray, labels: list[str], y_cut: int) -> np.ndarray:
    h, w = base.shape[:2]
    work = base.copy()
    gold_h = 4
    label_h = 52
    logo_size = 76
    logo_pad = 10
    reserved = label_h + logo_size + logo_pad + 14
    available = h - y_cut - gold_h - reserved
    food_h = max(220, min(available, int(food.shape[0] * w / food.shape[1])))
    # If the photo is shorter than the hole, grow it so leftover black is small.
    if available - food_h > 40:
        food_h = available
    food_resized = cv2.resize(food, (w, food_h), interpolation=cv2.INTER_AREA)
    # Designed black sides band — covers leftover 3-pan units completely.
    work[y_cut:, :] = (8, 8, 8)
    work[y_cut : y_cut + gold_h, :] = (0, 208, 246)
    fy0 = y_cut + gold_h
    fy1 = fy0 + food_h
    work[fy0:fy1, :] = food_resized
    label_top = fy1 + 8
    overlay = draw_labels(w, label_h, labels)
    alpha = overlay[:, :, 3].astype(np.float32) / 255.0
    dest = work[label_top : label_top + label_h, :].astype(np.float32)
    rgb = overlay[:, :, :3].astype(np.float32)
    work[label_top : label_top + label_h, :] = np.clip(
        rgb * alpha[:, :, None] + dest * (1.0 - alpha[:, :, None]),
        0,
        255,
    ).astype(np.uint8)
    # Soft seam so the new band does not read as a hard paste.
    if y_cut > 8:
        fade = np.linspace(1.0, 0.0, 10, dtype=np.float32)[:, None, None]
        band = work[y_cut - 10 : y_cut, :].astype(np.float32)
        orig = base[y_cut - 10 : y_cut, :].astype(np.float32)
        work[y_cut - 10 : y_cut, :] = (orig * fade + band * (1.0 - fade)).astype(np.uint8)
    return work, label_top + label_h + 6, logo_size


def main() -> int:
    food = extract_food_band()
    badge = cv2.imread(BADGE, cv2.IMREAD_UNCHANGED)
    if badge is None or badge.shape[2] != 4:
        print('official badge missing or not RGBA')
        return 1
    report = {
        'food_band': os.path.relpath(FOOD_BAND, ROOT),
        'official_badge': os.path.basename(BADGE),
        'ai_generated_food': False,
        'pricing_changed': False,
        'jobs': {},
    }
    for job in JOBS:
        src = os.path.join(FOLDERS, job['src'])
        image = cv2.imread(src, cv2.IMREAD_COLOR)
        if image is None or image.shape != (1536, 1024, 3):
            report['jobs'][job['src']] = {'status': 'missing_or_bad_size'}
            print('skip', job['src'])
            continue
        work, logo_top, logo_size = compose(
            image, food, LABELS[job['locale']], job['y_cut']
        )
        if job['stamp']:
            # One official badge only, under the labels, never over type.
            work = stamp_official(
                work, badge, 18, min(logo_top, 1536 - logo_size - 8), logo_size
            )
        dest = os.path.join(FOLDERS, job['dest'])
        cv2.imwrite(dest, work, [cv2.IMWRITE_WEBP_QUALITY, 92])
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-full.jpg')),
            cv2.resize(work, (360, 540)),
            [int(cv2.IMWRITE_JPEG_QUALITY), 86],
        )
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-sides.jpg')),
            work[job['y_cut'] - 20 :, :],
            [int(cv2.IMWRITE_JPEG_QUALITY), 88],
        )
        report['jobs'][job['src']] = {
            'dest': job['dest'],
            'locale': job['locale'],
            'y_cut': job['y_cut'],
            'labels': LABELS[job['locale']],
            'OLD_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["src"]}',
            'NEW_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["dest"]}',
        }
        print(f'{job["src"]} -> {job["dest"]}')

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
