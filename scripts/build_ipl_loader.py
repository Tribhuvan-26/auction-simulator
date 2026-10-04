"""Builds the vector data for the landing loader (src/components/ui/Loader.tsx).

Run:  python scripts/build_ipl_loader.py

Sources:
  public/assets/brand/ipl-logo-official.svg  official IPL logo (Wikipedia, File:Indian_Premier_League_Official_Logo.svg)
  public/assets/brand/cricket-frames/         the 42-frame swing; frame 42 is the logo pose
  public/assets/brand/ipl-cricketer.png       the same batsman mark as a flat white raster

Writes public/assets/brand/ipl-loader.json, all in the official SVG's viewBox units:
  group      the transform every official path sits under
  mark       batsman paths {d, transform, part: body|swoosh}
  lines      wordmark paths per line (INDIAN / PREMIER / LEAGUE) + each line's box
  frames     the 42 swing frames traced to path data, aligned so frame 42 sits on the mark
  viewBox    one box that holds every frame and the mark
  contact    where the bat meets the ball, on frame CONTACT_FRAME
"""
import json
import os
import re

import cv2
import numpy as np

BRAND = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'brand')
UP = 8  # trace at 8x so edges come out smooth
CONTACT_FRAME = 17  # 0-based: frame_18.png, the last frame with the bat low, just before it whips up
CONTACT_PX = (145, 124)  # on frame_18.png: the blade, just inside its tip

# path indices in the official SVG (0 is the clip rect): letters 1-19, batsman 20-23, (R) 24
LINES = {'INDIAN': range(1, 7), 'PREMIER': range(7, 14), 'LEAGUE': range(14, 20)}
MARK = {20: 'body', 21: 'swoosh', 22: 'swoosh', 23: 'body'}
# boxes in viewBox units, measured in the browser (getBoundingClientRect per path group)
MARK_BOX = (0.0046, 0.0591, 12.4419, 19.6847)
LINE_BOX = {'INDIAN': (13.6125, 3.5082, 20.3394, 4.0785), 'PREMIER': (13.6125, 8.6043, 24.621, 4.0261), 'LEAGUE': (13.6126, 13.6367, 21.5073, 4.1656)}


def alpha(path):
    return cv2.imread(path, cv2.IMREAD_UNCHANGED)[..., 3]


def bbox(a):
    ys, xs = np.nonzero(a > 127)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def trace(a, transform):
    """Silhouette alpha -> SVG path (evenodd), points mapped by transform(x, y)."""
    big = cv2.resize(a, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), UP * 0.45)
    _, m = cv2.threshold(big, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in contours:
        if cv2.contourArea(c) < (UP * 1.2) ** 2:
            continue
        c = cv2.approxPolyDP(c, UP * 0.18, True)[:, 0, :] / UP
        parts.append('M' + 'L'.join('%.3f %.3f' % transform(x, y) for x, y in c) + 'Z')
    return ''.join(parts)


def fit(src, dst):
    """Scale + offset putting src alpha onto dst alpha with the best overlap (IoU)."""
    target = dst > 127
    sx0, sy0, sx1, sy1 = bbox(src)
    dx0, dy0, dx1, dy1 = bbox(dst)
    best = (-1, None)
    base = (dy1 - dy0) / (sy1 - sy0)
    for s in np.linspace(base * 0.85, base * 1.2, 15):
        warped = cv2.resize(src, None, fx=s, fy=s, interpolation=cv2.INTER_LINEAR) > 127
        cx = (dx0 + dx1) / 2 - (sx0 + sx1) / 2 * s
        cy = (dy0 + dy1) / 2 - (sy0 + sy1) / 2 * s
        for ox in range(-30, 31, 2):
            for oy in range(-30, 31, 2):
                tx, ty = int(round(cx + ox)), int(round(cy + oy))
                canvas = np.zeros_like(target)
                h, w = warped.shape
                x0, y0 = max(tx, 0), max(ty, 0)
                x1, y1 = min(tx + w, canvas.shape[1]), min(ty + h, canvas.shape[0])
                if x1 <= x0 or y1 <= y0:
                    continue
                canvas[y0:y1, x0:x1] = warped[y0 - ty:y1 - ty, x0 - tx:x1 - tx]
                iou = (canvas & target).sum() / max((canvas | target).sum(), 1)
                if iou > best[0]:
                    best = (iou, (s, tx, ty))
    print(f'frame 42 -> mark IoU {best[0]:.2f}')
    return best[1]


def main():
    svg = open(os.path.join(BRAND, 'ipl-logo-official.svg'), encoding='utf-8').read()
    group = re.search(r'<g clip-path="url\(#a\)" transform="([^"]*)"', svg).group(1)
    paths = []
    for m in re.finditer(r'<path ([^>]*?)/>', svg):
        a = m.group(1)
        t = re.search(r'transform="([^"]*)"', a)
        paths.append({'d': re.search(r'd="([^"]*)"', a).group(1), 'transform': t.group(1) if t else ''})

    # frame px -> ipl-cricketer.png px (best overlap of frame 42) -> official viewBox units
    # (the png and the official mark are the same artwork, so their boxes map linearly)
    png = alpha(os.path.join(BRAND, 'ipl-cricketer.png'))
    frames = [alpha(os.path.join(BRAND, 'cricket-frames', f'frame_{i:02d}.png')) for i in range(1, 43)]
    s, dx, dy = fit(frames[-1], png)
    px0, py0, px1, py1 = bbox(png)
    mx, my, mw, mh = MARK_BOX
    kx, ky = mw / (px1 - px0), mh / (py1 - py0)
    to_vb = lambda x, y: (mx + (x * s + dx - px0) * kx, my + (y * s + dy - py0) * ky)  # noqa: E731

    traced = [trace(f, to_vb) for f in frames]
    corners = [to_vb(*bbox(f)[:2]) for f in frames] + [to_vb(*bbox(f)[2:]) for f in frames]
    x0 = min(mx, min(c[0] for c in corners)) - 0.3
    y0 = min(my, min(c[1] for c in corners)) - 0.3
    x1 = max(mx + mw, max(c[0] for c in corners)) + 0.3
    y1 = max(my + mh, max(c[1] for c in corners)) + 0.3

    out = {
        'group': group,
        'mark': [{**paths[i], 'part': part} for i, part in MARK.items()],
        'markBox': MARK_BOX,
        'lines': [{'text': name, 'box': LINE_BOX[name], 'paths': [paths[i] for i in idx]} for name, idx in LINES.items()],
        'frames': traced,
        'viewBox': [round(x0, 3), round(y0, 3), round(x1 - x0, 3), round(y1 - y0, 3)],
        'contactFrame': CONTACT_FRAME,
        'contact': [round(v, 3) for v in to_vb(*CONTACT_PX)],
    }
    dest = os.path.join(BRAND, 'ipl-loader.json')
    with open(dest, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(out['viewBox'], out['contact'], f'{os.path.getsize(dest) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
