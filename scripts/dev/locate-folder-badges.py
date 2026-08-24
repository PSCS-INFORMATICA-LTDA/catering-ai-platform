"""Find the CDL badge on each package folder.

The badges in the artwork are approximations of the real mark, so a colour match
will not work. What survives the approximation is the ring-and-centre edge
structure, which correlates strongly with the official logo's edges across a
range of plausible sizes.

Emits JSON on stdout: {filename: {x, y, size, score}}.
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
LOGO = os.path.join(ROOT, 'public', 'cdl', 'logo-cdl.png')
FOLDERS = os.path.join(ROOT, 'assets', 'packages', 'folders-v2', '*.webp')


def edges(image):
    return cv2.Canny(cv2.GaussianBlur(image, (3, 3), 0), 60, 160).astype(np.float32)


def main():
    logo = cv2.imread(LOGO, cv2.IMREAD_GRAYSCALE)
    if logo is None:
        print(f'cannot read {LOGO}', file=sys.stderr)
        return 1
    ys, xs = np.nonzero(logo < 200)
    logo = logo[ys.min():ys.max(), xs.min():xs.max()]

    results = {}
    for path in sorted(glob.glob(FOLDERS)):
        image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        height, width = image.shape
        target = edges(image)
        best = None
        for size in range(int(width * 0.10), int(width * 0.32), 4):
            template = edges(cv2.resize(logo, (size, size), interpolation=cv2.INTER_AREA))
            if template.shape[0] >= target.shape[0] or template.shape[1] >= target.shape[1]:
                continue
            match = cv2.matchTemplate(target, template, cv2.TM_CCOEFF_NORMED)
            _, score, _, loc = cv2.minMaxLoc(match)
            if best is None or score > best['score']:
                best = {'x': int(loc[0]), 'y': int(loc[1]), 'size': size, 'score': float(score)}
        results[os.path.basename(path)] = best

    json.dump(results, sys.stdout, indent=2)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
