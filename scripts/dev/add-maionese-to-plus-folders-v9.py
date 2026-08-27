"""Replace the right-hand vinagrete richa with Brazilian potato salad.

Existing plus folders stay the identity (title, meats, logo, rice, beans).
Vinagrete remains the optional TEXT choice; the third pan becomes Maionese
so the row keeps three premium dishes and does not look squeezed.

Run: python3 scripts/dev/add-maionese-to-plus-folders-v9.py
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PACKAGES = os.path.join(ROOT, 'assets', 'packages')
FOLDERS = os.path.join(PACKAGES, 'folders-v3')
MAYO = os.path.join(ROOT, 'assets', 'additionals', 'guarnicoes', 'item-076-clean.webp')
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts', 'GreatVibes-Regular.ttf')
PREVIEW = '/tmp/art-audit/mayo/v9'
REPORT = os.path.join(PACKAGES, 'folder-plus-maionese-v9.json')
os.makedirs(PREVIEW, exist_ok=True)

LABEL = {
    'pt': 'Maionese',
    'en': 'Potato salad',
    'es': 'Ensalada de papa',
}

# food_search / plaque_search are inclusive pixel boxes (x0, y0, x1, y1).
# oval = standalone chafing dish. rect = right well of a 3-compartment unit.
JOBS = [
    {
        'src': 'bbqpers-plus-pt-v8.webp',
        'dest': 'bbqpers-plus-pt-v9.webp',
        'locale': 'pt',
        'shape': 'oval',
        'food_search': (700, 1075, 1018, 1310),
        'plaque_search': (600, 1295, 940, 1455),
        'logo': (106, 1436, 92),
    },
    {
        'src': 'bbqpers-plus-en-v6.webp',
        'dest': 'bbqpers-plus-en-v9.webp',
        'locale': 'en',
        'shape': 'rect',
        'food_search': (690, 1048, 1005, 1265),
        'plaque_search': (600, 1235, 940, 1410),
        'logo': (108, 1410, 90),
    },
    {
        'src': 'bbqpers-plus-es-v6.webp',
        'dest': 'bbqpers-plus-es-v9.webp',
        'locale': 'es',
        'shape': 'rect',
        'food_search': (700, 1045, 1010, 1268),
        'plaque_search': (610, 1230, 960, 1410),
        'logo': (108, 1410, 90),
    },
    {
        'src': 'bbqtrad-plus-pt-v4.webp',
        'dest': 'bbqtrad-plus-pt-v9.webp',
        'locale': 'pt',
        'shape': 'oval',
        'food_search': (705, 1070, 1018, 1315),
        'plaque_search': (610, 1305, 940, 1460),
        'logo': (110, 1430, 90),
    },
    {
        'src': 'bbqtrad-plus-en-v4.webp',
        'dest': 'bbqtrad-plus-en-v9.webp',
        'locale': 'en',
        'shape': 'oval',
        'food_search': (705, 1070, 1018, 1315),
        'plaque_search': (610, 1305, 950, 1465),
        'logo': (110, 1430, 90),
    },
    {
        'src': 'bbqtrad-plus-es-v3.webp',
        'dest': 'bbqtrad-plus-es-v9.webp',
        'locale': 'es',
        'shape': 'oval',
        'food_search': (700, 1060, 1018, 1310),
        'plaque_search': (600, 1290, 950, 1455),
        'logo': (110, 1430, 90),
    },
    {
        'src': 'bbqsel-plus-pt-v4.webp',
        'dest': 'bbqsel-plus-pt-v9.webp',
        'locale': 'pt',
        'shape': 'rect',
        'food_search': (685, 1048, 990, 1255),
        'plaque_search': (680, 1325, 960, 1490),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqsel-plus-en-v3.webp',
        'dest': 'bbqsel-plus-en-v9.webp',
        'locale': 'en',
        'shape': 'rect',
        'food_search': (675, 1040, 980, 1248),
        'plaque_search': (660, 1305, 950, 1475),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqsel-plus-es-v3.webp',
        'dest': 'bbqsel-plus-es-v9.webp',
        'locale': 'es',
        'shape': 'rect',
        'food_search': (690, 1055, 995, 1265),
        'plaque_search': (670, 1320, 970, 1490),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqcho-plus-pt-v3.webp',
        'dest': 'bbqcho-plus-pt-v9.webp',
        'locale': 'pt',
        'shape': 'rect',
        'food_search': (670, 1035, 990, 1240),
        'plaque_search': (660, 1285, 960, 1465),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqcho-plus-en-v4.webp',
        'dest': 'bbqcho-plus-en-v9.webp',
        'locale': 'en',
        'shape': 'rect',
        'food_search': (660, 1030, 985, 1238),
        'plaque_search': (650, 1280, 955, 1460),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqcho-plus-es-v3.webp',
        'dest': 'bbqcho-plus-es-v9.webp',
        'locale': 'es',
        'shape': 'rect',
        'food_search': (670, 1045, 990, 1255),
        'plaque_search': (660, 1300, 960, 1475),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqpri-plus-pt-v4.webp',
        'dest': 'bbqpri-plus-pt-v9.webp',
        'locale': 'pt',
        'shape': 'rect',
        'food_search': (700, 1048, 1010, 1270),
        'plaque_search': (610, 1255, 920, 1430),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqpri-plus-en-v4.webp',
        'dest': 'bbqpri-plus-en-v9.webp',
        'locale': 'en',
        'shape': 'rect',
        'food_search': (698, 1055, 1010, 1275),
        'plaque_search': (610, 1260, 930, 1440),
        'logo': (110, 1410, 90),
    },
    {
        'src': 'bbqpri-plus-es-v3.webp',
        'dest': 'bbqpri-plus-es-v9.webp',
        'locale': 'es',
        'shape': 'rect',
        'food_search': (700, 1050, 1010, 1272),
        'plaque_search': (610, 1258, 940, 1440),
        'logo': (110, 1410, 90),
    },
]


def extract_mayo(path: str) -> np.ndarray:
    photo = cv2.imread(path, cv2.IMREAD_COLOR)
    if photo is None:
        raise FileNotFoundError(path)
    h, w = photo.shape[:2]
    # Bowl mound only — official extra badge sits bottom-right.
    return photo[int(h * 0.18) : int(h * 0.70), int(w * 0.18) : int(w * 0.70)]


def veg_mask(hsv: np.ndarray) -> np.ndarray:
    h, s, v = cv2.split(hsv)
    red = ((h <= 12) | (h >= 168)) & (s >= 40) & (v >= 40)
    green = (h >= 30) & (h <= 90) & (s >= 28) & (v >= 35)
    orange = (h >= 8) & (h <= 28) & (s >= 55) & (v >= 55)
    pale = (s < 55) & (v >= 115) & (v <= 235)
    return (red | green | orange | pale).astype(np.uint8) * 255


def metal_mask(hsv: np.ndarray) -> np.ndarray:
    s, v = hsv[:, :, 1], hsv[:, :, 2]
    return ((s < 32) & (v > 155)).astype(np.uint8) * 255


def food_mask(image: np.ndarray, search: tuple[int, int, int, int], shape: str) -> np.ndarray:
    x0, y0, x1, y1 = search
    h, w = image.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    roi = image[y0:y1, x0:x1]
    if roi.size == 0:
        return mask
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    veg = veg_mask(hsv)
    metal = metal_mask(hsv)
    veg[metal > 0] = 0
    veg = cv2.morphologyEx(veg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    veg = cv2.morphologyEx(veg, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(veg)
    if n <= 1:
        return mask
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    veg = np.where(lab == idx, 255, 0).astype(np.uint8)
    ys, xs = np.where(veg > 0)
    if len(xs) < 80:
        return mask
    seed = (int(np.median(xs)), int(np.median(ys)))
    barrier = cv2.dilate(metal, np.ones((3, 3), np.uint8))
    walkable = np.where(barrier > 0, 0, 255).astype(np.uint8)
    if walkable[seed[1], seed[0]] == 0:
        nearby = np.column_stack(np.where(walkable > 0))
        if len(nearby) == 0:
            return mask
        seed = (int(nearby[0][1]), int(nearby[0][0]))
    fill = np.zeros((walkable.shape[0] + 2, walkable.shape[1] + 2), np.uint8)
    cv2.floodFill(
        walkable,
        fill,
        seed,
        255,
        flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8) | 4,
    )
    local = fill[1:-1, 1:-1]
    # Contain leaks if the steel ring is broken: stay near the fitted dish.
    contain = np.zeros_like(local)
    if shape == 'oval':
        pts = np.column_stack([xs, ys]).astype(np.float32)
        (cx, cy), (ew, eh), ang = cv2.fitEllipse(pts)
        cv2.ellipse(
            contain,
            (int(round(cx)), int(round(cy))),
            (max(8, int(ew * 0.60)), max(8, int(eh * 0.60))),
            ang,
            0,
            360,
            255,
            -1,
        )
    else:
        rect = cv2.minAreaRect(np.column_stack([xs, ys]).astype(np.float32))
        (cx, cy), (rw, rh), ang = rect
        box = cv2.boxPoints(((cx, cy), (rw * 1.08, rh * 1.08), ang)).astype(np.int32)
        cv2.fillConvexPoly(contain, box, 255)
    local = cv2.bitwise_and(local, contain)
    rim = cv2.dilate(metal, np.ones((7, 7), np.uint8))
    local[rim > 0] = 0
    local = cv2.erode(local, np.ones((2, 2), np.uint8))
    mask[y0:y1, x0:x1] = local
    return mask


def grade_mayo(patch: np.ndarray) -> np.ndarray:
    warm = np.clip(patch.astype(np.float32) * np.array([0.96, 1.03, 1.08]), 0, 255)
    return warm.astype(np.uint8)


def fill_food(image: np.ndarray, mayo: np.ndarray, mask: np.ndarray) -> np.ndarray:
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return image
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    w, h = x1 - x0, y1 - y0
    patch = grade_mayo(cv2.resize(mayo, (w, h), interpolation=cv2.INTER_AREA))
    dest = image[y0:y1, x0:x1]
    local = mask[y0:y1, x0:x1]
    # Prefer Poisson blend when the mask sits fully inside the crop.
    clone_mask = local.copy()
    clone_mask[:2, :] = 0
    clone_mask[-2:, :] = 0
    clone_mask[:, :2] = 0
    clone_mask[:, -2:] = 0
    out = image.copy()
    if int((clone_mask > 0).sum()) > 400:
        cx, cy = x0 + w // 2, y0 + h // 2
        try:
            cloned = cv2.seamlessClone(patch, dest, clone_mask, (w // 2, h // 2), cv2.NORMAL_CLONE)
            alpha = cv2.GaussianBlur(local, (0, 0), 0.4).astype(np.float32) / 255.0
            mixed = cloned.astype(np.float32) * alpha[:, :, None] + dest.astype(np.float32) * (
                1.0 - alpha[:, :, None]
            )
            out[y0:y1, x0:x1] = mixed.astype(np.uint8)
            return out
        except cv2.error:
            pass
    alpha = cv2.GaussianBlur(local, (0, 0), 0.4).astype(np.float32) / 255.0
    orig_v = cv2.cvtColor(dest, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    mayo_v = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    light = np.clip(0.82 + 0.28 * orig_v / np.maximum(mayo_v, 0.22), 0.75, 1.12)
    lit = np.clip(patch.astype(np.float32) * light[:, :, None], 0, 255)
    blended = lit * alpha[:, :, None] + dest.astype(np.float32) * (1.0 - alpha[:, :, None])
    out[y0:y1, x0:x1] = blended.astype(np.uint8)
    return out


def _expand_dark_card(gray: np.ndarray, box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x, y, w, h = box
    height, width = gray.shape
    # Ink bbox is tight on the script. Pad to the chalkboard, but do not
    # walk into the table or the pan — those are also dark.
    target_w = min(280, max(236, w + 110))
    target_h = min(84, max(68, h + 28))
    cx = x + w / 2
    cy = y + h / 2 + 2
    left = int(round(cx - target_w / 2))
    top = int(round(cy - target_h / 2))
    left = max(0, min(left, width - target_w))
    top = max(0, min(top, height - target_h))
    return left, top, target_w, target_h


def find_plaque(image: np.ndarray, search: tuple[int, int, int, int]) -> tuple[int, int, int, int] | None:
    x0, y0, x1, y1 = search
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    v = hsv[:, :, 2].astype(np.float32)
    s = hsv[:, :, 1]
    ink = ((hsv[:, :, 2] > 150) & (s < 70)).astype(np.uint8) * 255
    dark_nb = cv2.blur(v, (25, 25)) < 80
    ink[~dark_nb] = 0
    roi = np.zeros(hsv.shape[:2], np.uint8)
    roi[y0:y1, x0:x1] = ink[y0:y1, x0:x1]
    roi = cv2.morphologyEx(roi, cv2.MORPH_CLOSE, np.ones((5, 13), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(roi)
    best = None
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 80 or w < 40 or h < 12:
            continue
        if best is None or area > best[0]:
            best = (int(area), (int(x), int(y), int(w), int(h)))
    if best is None:
        return None
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return _expand_dark_card(gray, best[1])


def render_script(text: str, width: int, height: int) -> Image.Image:
    card = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    size = 40 if len(text) < 10 else 32 if len(text) < 16 else 24
    font = ImageFont.truetype(FONT, size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    while (tw > width - 18 or th > height - 8) and size > 15:
        size -= 1
        font = ImageFont.truetype(FONT, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (width - tw) / 2 - bbox[0]
    y = (height - th) / 2 - bbox[1] - 1
    cream = (222, 214, 200, 255)
    draw.text((x + 0.6, y + 0.8), text, font=font, fill=(22, 16, 10, 50))
    draw.text((x + 0.6, y), text, font=font, fill=cream)
    draw.text((x, y), text, font=font, fill=cream)
    return card.filter(ImageFilter.SMOOTH)


def rewrite_plaque(image: np.ndarray, box: tuple[int, int, int, int], text: str) -> np.ndarray:
    x, y, w, h = box
    roi = image[y : y + h, x : x + w]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    dark = roi[gray < 70]
    fill = (
        tuple(int(round(channel)) for channel in dark.mean(axis=0))
        if len(dark)
        else (12, 10, 8)
    )
    cleaned = roi.copy()
    # Chalkboard + leftover script go to black. Gold clips/frames stay.
    gold = (hsv[:, :, 2] > 90) & (hsv[:, :, 1] > 35)
    wood = (
        (hsv[:, :, 0] >= 5)
        & (hsv[:, :, 0] <= 25)
        & (hsv[:, :, 1] >= 18)
        & (hsv[:, :, 2] >= 18)
        & (hsv[:, :, 2] <= 120)
    )
    cleaned[~(gold | wood)] = fill
    script = render_script(text, w, h)
    rgba = np.array(script)
    alpha = rgba[:, :, 3].astype(np.float32) / 255.0
    rgb = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGR).astype(np.float32)
    composed = rgb * alpha[:, :, None] + cleaned.astype(np.float32) * (1.0 - alpha[:, :, None])
    out = image.copy()
    out[y : y + h, x : x + w] = composed.astype(np.uint8)
    return out


def protect_logo(original: np.ndarray, work: np.ndarray, logo: tuple[int, int, int] | None) -> np.ndarray:
    if not logo:
        return work
    cx, cy, r = logo
    yy, xx = np.ogrid[: work.shape[0], : work.shape[1]]
    disk = (xx - cx) ** 2 + (yy - cy) ** 2 <= r ** 2
    work = work.copy()
    work[disk] = original[disk]
    return work


def main() -> int:
    mayo = extract_mayo(MAYO)
    report = {
        'official_mayo_source': 'assets/additionals/guarnicoes/item-076-clean.webp',
        'ai_generated_food': False,
        'pricing_changed': False,
        'jobs': {},
    }
    for job in JOBS:
        src = os.path.join(FOLDERS, job['src'])
        image = cv2.imread(src, cv2.IMREAD_COLOR)
        if image is None:
            report['jobs'][job['src']] = {'status': 'missing'}
            continue
        original = image.copy()
        mask = food_mask(image, job['food_search'], job['shape'])
        work = fill_food(image, mayo, mask)
        plaque = find_plaque(work, job['plaque_search'])
        if plaque is None:
            # Fallback: dark rectangle in the search box centre.
            x0, y0, x1, y1 = job['plaque_search']
            plaque = (x0 + 20, y0 + 20, max(120, x1 - x0 - 40), 72)
        work = rewrite_plaque(work, plaque, LABEL[job['locale']])
        work = protect_logo(original, work, job.get('logo'))
        dest = os.path.join(FOLDERS, job['dest'])
        cv2.imwrite(dest, work, [cv2.IMWRITE_WEBP_QUALITY, 92])

        y_preview = min(job['food_search'][1], job['plaque_search'][1]) - 10
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-full.jpg')),
            cv2.resize(work, (360, 540)),
            [int(cv2.IMWRITE_JPEG_QUALITY), 86],
        )
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-sides.jpg')),
            work[max(0, y_preview) :, :],
            [int(cv2.IMWRITE_JPEG_QUALITY), 88],
        )
        overlay = work.copy()
        overlay[mask > 0] = (overlay[mask > 0] * 0.65 + np.array([0, 200, 255]) * 0.35).astype(
            np.uint8
        )
        px, py, pw, ph = plaque
        cv2.rectangle(overlay, (px, py), (px + pw, py + ph), (0, 0, 255), 2)
        cv2.imwrite(
            os.path.join(PREVIEW, job['dest'].replace('.webp', '-boxes.jpg')),
            overlay[max(0, y_preview) :, :],
            [int(cv2.IMWRITE_JPEG_QUALITY), 84],
        )
        if plaque:
            cv2.imwrite(
                os.path.join(PREVIEW, job['dest'].replace('.webp', '-plaque.jpg')),
                work[max(0, py - 8) : py + ph + 8, max(0, px - 8) : px + pw + 8],
            )
        changed = np.abs(work.astype(np.int16) - original.astype(np.int16)).mean()
        report['jobs'][job['src']] = {
            'dest': job['dest'],
            'locale': job['locale'],
            'label': LABEL[job['locale']],
            'plaque': list(plaque),
            'food_px': int((mask > 0).sum()),
            'mae': float(changed),
            'OLD_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["src"]}',
            'NEW_IMAGE_PATH': f'package-images/cdl-folders-v3/{job["dest"]}',
        }
        print(f'{job["src"]} -> {job["dest"]} food={int((mask > 0).sum())} plaque={plaque} mae={changed:.3f}')

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
        fh.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
