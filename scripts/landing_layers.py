"""Cuts the Figma courtyard image into animatable landing-page layers.

Run:  python scripts/landing_layers.py blender/assets/figma-scene-4bay.png

The source is the Figma courtyard with a fourth banner (on the big pillar) added by an AI
image edit. Its cloths hang in the wrong team order and carry doubled emblems, so each is
cut, its emblem painted out, and its cloth re-dyed (light and folds kept, hue swapped) to
the order CSK, MI, RCB, SRH; the page prints the emblems back on.

Writes public/assets/landing/layers/:
  bg.webp                 the scene with the banners painted out (edges only
                          ever show a few px, so OpenCV inpaint is enough)
  banner-{csk,mi,rcb,srh}.webp  each banner cut out, cropped, with its box in
                          layers.json
  plants.webp             both planters' foliage (sways in place, no cut needed)
  case-lines.webp         the glass case's frame where it crosses the cloth (sits on top)
  wall-front.webp         the concrete block in front of the SRH banner (sits on top)
  sky-mask.png            where clouds drift
  trophy-mask.png         gold of the trophy, for the light glint
  sun-mask.png            sunlit areas, for the light breathing + dust
  layers.json             boxes for everything above, in image px (1536x1024)
"""
import json
import os
import sys

import cv2
import numpy as np

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'landing', 'layers')


def largest(m):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    return np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8) if n > 1 else m


def in_box(m, x0, y0, x1, y1):
    out = np.zeros_like(m)
    out[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    return out


def case_top(x):
    """Top edge of the glass case (front pane then side pane): banners hang behind it."""
    return 492 - 0.2344 * (x - 926) if x <= 1118 else 445 + (25 / 77) * (x - 1118)


def fill_holes(m):
    filled = np.zeros_like(m)
    cv2.drawContours(filled, cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], -1, 255, -1)
    return filled


def banner_mask(colour, box, extend_to_top=False, through_glass_to=None, behind_case=True):
    # fill the logo hole first, or the opening splits the banner in two
    m = fill_holes(largest(cv2.morphologyEx(in_box(colour, *box), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))))
    m = largest(cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))))
    # fill each row between its outermost banner pixels; a convex hull pulls in wall slivers
    out = np.zeros_like(m)
    for y in np.nonzero(m.any(axis=1))[0]:
        xs = np.nonzero(m[y])[0]
        out[y, xs.min():xs.max() + 1] = 255
    out = cv2.medianBlur(out, 5)
    if extend_to_top:  # banner continues above the frame; colour test misses its shadowed top
        ys, xs = np.nonzero(out)
        top = ys.min()
        row = xs[ys == top]
        out[:top + 1, row.min():row.max() + 1] = 255
    if behind_case:
        for x in range(out.shape[1]):
            out[int(case_top(x)):, x] = 0
    if through_glass_to:
        # behind the glass the colour test is unreliable (tint, shadow), so carry the cloth
        # straight down from its edges at the glass line to where it fades out
        xs = np.nonzero(out.any(axis=0))[0]
        for x in range(xs.min(), xs.max() + 1):
            col = np.nonzero(out[:, x])[0]
            if len(col) and col.max() >= int(case_top(x)) - 3:
                out[col.max():through_glass_to, x] = 255
    return out


def fade_bottom(mask, length):
    """Alpha ramps to 0 over the last `length` rows of each column: the moving cloth melts
    into the painted cloth under it instead of ending on a hard, sliding edge."""
    out = mask.astype(float)
    for x in np.nonzero(mask.any(axis=0))[0]:
        bottom = np.nonzero(mask[:, x])[0].max()
        top = max(0, bottom - length)
        out[top:bottom + 1, x] *= np.linspace(1, 0, bottom + 1 - top)
    return out.astype(np.uint8)


def rgba_crop(im, mask, feather=1.2):
    alpha = cv2.GaussianBlur(mask, (0, 0), feather)
    x, y, w, h = cv2.boundingRect(mask)
    rgba = np.dstack([im, alpha])[y:y + h, x:x + w]
    return rgba, [int(x), int(y), int(w), int(h)]


def save_mask(name, m):
    """White with the mask as alpha: what CSS mask-image expects."""
    cv2.imwrite(os.path.join(OUT, name), np.dstack([np.full_like(m, 255)] * 3 + [m]))


def soft_mask(m, blur):
    return cv2.GaussianBlur(m, (0, 0), blur)


def main(src):
    im = cv2.imread(src)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    hue, sat, val = (hsv[..., i].astype(int) for i in range(3))
    vivid = (sat > 90) & (val > 40)
    as_mask = lambda b: b.astype(np.uint8) * 255  # noqa: E731
    os.makedirs(OUT, exist_ok=True)
    layout = {}

    # keyed by the team each cloth becomes; the colour test finds the cloth as generated
    banners = {
        'csk': banner_mask(as_mask((hue > 4) & (hue < 20) & vivid), (770, 0, 930, 610), extend_to_top=True, behind_case=False),
        'mi': banner_mask(as_mask((hue > 100) & (hue < 130) & vivid), (940, 60, 1080, 500), through_glass_to=520),
        'rcb': banner_mask(as_mask((hue > 12) & (hue < 35) & vivid & (sat > 150)), (1070, 30, 1195, 470), through_glass_to=550),
        'srh': banner_mask(as_mask(((hue < 10) | (hue > 160)) & vivid), (1185, 0, 1320, 490), extend_to_top=True, behind_case=False),
    }
    # each team's dye (median hue, saturation, value) read off the cloth that has it as generated
    dye = {}
    for team, src in (('csk', 'rcb'), ('rcb', 'srh'), ('srh', 'csk')):  # yellow, red, orange cloths
        m = banners[src] > 0
        dye[team] = [np.median(hsv[..., c][m]) for c in range(3)]

    # paint out the generated emblems (all but MI's), staying clear of the cloth's edges
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    emblems = {
        'csk': in_box(cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k), 790, 200, 910, 350),  # eagle, dark ink
        'rcb': in_box(cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k), 1085, 190, 1185, 345),  # lion, dark ink
        'srh': in_box(cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k), 1205, 165, 1295, 335),  # crowned lion, pale
    }
    cloth = im.copy()
    for name, ink in emblems.items():
        inner = cv2.erode(banners[name], np.ones((1, 15), np.uint8))
        ink = cv2.dilate(np.where(ink > 18, 255, 0).astype(np.uint8), np.ones((5, 5), np.uint8)) & inner
        cloth = cv2.inpaint(cloth, ink, 9, cv2.INPAINT_TELEA)

    for name, m in banners.items():
        out = cloth
        if name in dye:  # re-dye: keep the cloth's light and folds (relative S and V), take the new dye
            h = cv2.cvtColor(cloth, cv2.COLOR_BGR2HSV).astype(float)
            h[..., 0] = dye[name][0]
            for c in (1, 2):
                h[..., c] *= dye[name][c] / max(np.median(h[..., c][m > 0]), 1)
            out = cv2.cvtColor(np.clip(h, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
        # pull the sides 2px inside the cloth so the soft edge carries no wall colour when it moves
        m = cv2.erode(m, np.ones((1, 5), np.uint8))
        # behind the glass the cloth melts away; the pillar cloth hangs free and SRH's bottom
        # is hidden by wall-front instead
        rgba, box = rgba_crop(out, m if name in ('csk', 'srh') else fade_bottom(m, 45))
        cv2.imwrite(os.path.join(OUT, f'banner-{name}.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 90])
        layout[f'banner-{name}'] = box

    behind = cv2.dilate(np.maximum.reduce(list(banners.values())), np.ones((7, 7), np.uint8))
    bg = cv2.inpaint(im, behind, 7, cv2.INPAINT_TELEA)
    cv2.imwrite(os.path.join(OUT, 'bg.webp'), bg, [cv2.IMWRITE_WEBP_QUALITY, 86])

    # the glass case's frame lines where they cross the cloth, drawn above the banners so the
    # case stays put while the cloth behind it moves
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    thin = np.maximum(cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k), cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k))
    glass = np.zeros_like(gray)
    for x in range(926, glass.shape[1]):  # the case starts at x=926; the pillar cloth left of it hangs free
        glass[int(case_top(x)) - 6:600, x] = 255
    lines = np.where((thin > 22) & (glass > 0) & (cv2.dilate(behind, np.ones((9, 9), np.uint8)) > 0), 255, 0).astype(np.uint8)
    lines = cv2.morphologyEx(lines, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    lines = cv2.dilate(lines, np.ones((3, 3), np.uint8))
    rgba, layout['case-lines'] = rgba_crop(im, lines, feather=0.8)
    cv2.imwrite(os.path.join(OUT, 'case-lines.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])

    # the concrete block (and its lit ledge) in front of the SRH banner's lower half, also on top
    ledge = lambda x: 423 - 0.29 * (x - 1234) - 1  # noqa: E731  1px above the light strip (higher picks up cloth)
    edge = lambda y: 1238 + (y - 450) * 3 / 70  # noqa: E731  just inside the block's left face
    block = np.array([[edge(ledge(edge(400))), ledge(edge(400))], [1345, ledge(1345)], [1345, 510], [edge(510), 510]], np.int32)
    front = np.zeros_like(gray)
    cv2.fillPoly(front, [block], 255)
    rgba, layout['wall-front'] = rgba_crop(im, front, feather=0.6)
    cv2.imwrite(os.path.join(OUT, 'wall-front.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])

    green = as_mask((hue > 25) & (hue < 100) & (sat > 30) & (val > 12))  # foliage is mostly in shadow
    plants = np.maximum(in_box(green, 1160, 520, 1400, 625), in_box(green, 1230, 720, 1536, 850))
    plants = cv2.morphologyEx(plants, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    rgba, layout['plants'] = rgba_crop(im, plants, feather=0.8)
    cv2.imwrite(os.path.join(OUT, 'plants.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 90])

    sky = as_mask((hue > 95) & (hue < 130) & (sat > 35) & (val > 140))
    sky = np.maximum(in_box(sky, 540, 60, 720, 230), in_box(sky, 1040, 0, 1090, 100))
    sky = cv2.morphologyEx(sky, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    x, y, w, h = cv2.boundingRect(sky)
    save_mask('sky-mask.png', soft_mask(sky, 2)[y:y + h, x:x + w])
    layout['sky'] = [x, y, w, h]

    gold = in_box(as_mask((hue > 8) & (hue < 32) & (sat > 70) & (val > 90)), 975, 500, 1135, 695)
    ellipse = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    gold = largest(cv2.morphologyEx(gold, cv2.MORPH_CLOSE, ellipse))
    gold = cv2.morphologyEx(fill_holes(gold), cv2.MORPH_OPEN, ellipse)  # blocky holes showed as patches in the glint
    x, y, w, h = cv2.boundingRect(gold)
    save_mask('trophy-mask.png', soft_mask(gold, 3)[y:y + h, x:x + w])
    layout['trophy'] = [x, y, w, h]

    # sunlit areas: bright at a coarse scale, so it follows the light shafts not texture
    lum = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (0, 0), 12)
    sun = np.clip((lum.astype(float) - 120) * 3, 0, 255).astype(np.uint8)
    save_mask('sun-mask.png', cv2.resize(sun, (768, 512), interpolation=cv2.INTER_AREA))

    with open(os.path.join(OUT, 'layers.json'), 'w') as f:
        json.dump(layout, f, indent=2)
    print(json.dumps(layout))


if __name__ == '__main__':
    main(sys.argv[1])
