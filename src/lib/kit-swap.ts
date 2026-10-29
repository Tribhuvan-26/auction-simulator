// Every /players/<code>-*.webp is a 750px studio portrait in the same pose, so a
// player can be "dressed" in another franchise's real kit by keeping his head
// and taking everything below the collar from a donor portrait of that
// franchise. One clean donor per franchise (short sleeves/long sleeves, no
// tattoos or watches where the roster allowed it).
const DONORS: Record<string, string> = {
  csk: 'csk-khaleel-ahmed', dc: 'dc-abishek-porel', gt: 'gt-jayant-yadav', kkr: 'kkr-blessing-muzarabani',
  lsg: 'lsg-abdul-samad', mi: 'mi-rohit-sharma', pbks: 'pbks-arshdeep-singh', rcb: 'rcb-bhuvneshwar-kumar',
  rr: 'rr-aman-rao', srh: 'srh-amit-kumar',
}

export const teamOfPhoto = (photoUrl: string): string | null => {
  const code = photoUrl.split('/').pop()?.split('-')[0] ?? ''
  return code in DONORS ? code : null
}

export const donorUrl = (teamCode: string): string | null =>
  DONORS[teamCode.toLowerCase()] ? `/players/${DONORS[teamCode.toLowerCase()]}.webp` : null

const CUT = 0.385 // collar line, as a fraction of the portrait height
const FEATHER = 14

function pixels(img: HTMLImageElement, w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/** Left edge, right edge of the body on each row, from alpha. */
function rowSpans(im: ImageData, w: number, h: number): { lo: number; hi: number }[] {
  const out: { lo: number; hi: number }[] = []
  for (let y = 0; y < h; y++) {
    let lo = -1, hi = -1
    for (let x = 0; x < w; x++) if (im.data[(y * w + x) * 4 + 3] > 128) { if (lo < 0) lo = x; hi = x }
    out.push({ lo, hi })
  }
  return out
}

/**
 * Narrows the donor's shoulders row by row to the player's width — otherwise a broader donor's shoulders make the player look
 * bulky under the new kit.
 */
function fitToBody(donor: ImageData, player: ImageData, w: number, h: number, fromY: number): ImageData {
  const sp = rowSpans(player, w, h), sd = rowSpans(donor, w, h)
  const raw = new Float32Array(h).fill(1)
  for (let y = fromY; y < h; y++) {
    if (sp[y].lo >= 0 && sd[y].lo >= 0 && sd[y].hi > sd[y].lo)
      raw[y] = Math.min(1.25, Math.max(0.6, (sp[y].hi - sp[y].lo) / (sd[y].hi - sd[y].lo)))
  }
  const R = 20
  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    let r = 0, n = 0
    for (let k = Math.max(0, y - R); k <= Math.min(h - 1, y + R); k++) { r += raw[k]; n++ }
    r /= n
    // Only the shoulders need narrowing; below that the donor's own arms stay
    // untouched, since warping them distorts the crossed forearms.
    const keep = Math.min(1, Math.max(0, (h * 0.6 - y) / (h * 0.1)))
    r = 1 + (r - 1) * keep
    const cp = sp[y].lo >= 0 ? (sp[y].lo + sp[y].hi) / 2 : w / 2
    const cd = sd[y].lo >= 0 ? (sd[y].lo + sd[y].hi) / 2 : w / 2
    for (let x = 0; x < w; x++) {
      const sx = cd + (x - cp) / r
      const x0 = Math.floor(sx), f = sx - x0
      if (x0 < 0 || x0 >= w - 1) continue
      for (let c = 0; c < 4; c++)
        out.data[(y * w + x) * 4 + c] = donor.data[(y * w + x0) * 4 + c] * (1 - f) + donor.data[(y * w + x0 + 1) * 4 + c] * f
    }
  }
  return out
}

function isSkin(r: number, g: number, b: number, a: number): boolean {
  if (a < 200) return false
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (max === 0 || d === 0) return false
  const s = d / max, v = max / 255
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return (h < 40 || h > 345) && s > 0.18 && s < 0.7 && v > 0.25
}

/**
 * Head and neck from `head`, everything below the collar from `donor`, with the
 * donor's skin (forearms, neck) tone-matched to the head's.
 */
export function swapKit(head: HTMLImageElement, donor: HTMLImageElement): HTMLCanvasElement {
  const w = head.naturalWidth, h = head.naturalHeight
  const P = pixels(head, w, h)
  // Fit the donor's silhouette to the player's build so he doesn't look bulky.
  const D = fitToBody(pixels(donor, w, h), P, w, h, Math.floor(h * CUT))
  const yc = Math.floor(h * CUT)

  // Mean skin colour above the collar line, for each portrait.
  const mean = (im: ImageData) => {
    const sum = [0, 0, 0]
    let n = 0
    for (let y = Math.floor(h * 0.2); y < yc; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (isSkin(im.data[i], im.data[i + 1], im.data[i + 2], im.data[i + 3])) {
          sum[0] += im.data[i]; sum[1] += im.data[i + 1]; sum[2] += im.data[i + 2]; n++
        }
      }
    return n ? sum.map((v) => v / n) : [1, 1, 1]
  }
  const mp = mean(P), md = mean(D)
  const gain = mp.map((v, i) => v / Math.max(md[i], 1))

  // Donor skin mask below the collar, softened so the tone shift has no hard edge.
  const y0 = yc - FEATHER
  const rows = h - y0
  let mask = new Float32Array(rows * w)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * w + x) * 4
      mask[y * w + x] = isSkin(D.data[i], D.data[i + 1], D.data[i + 2], D.data[i + 3]) ? 1 : 0
    }
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(mask.length)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0
        for (let dx = -2; dx <= 2; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) { s += mask[y * w + xx]; n++ } }
        tmp[y * w + x] = s / n
      }
    const out = new Float32Array(mask.length)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0
        for (let dy = -2; dy <= 2; dy++) { const yy = y + dy; if (yy >= 0 && yy < rows) { s += tmp[yy * w + x]; n++ } }
        out[y * w + x] = s / n
      }
    mask = out
  }

  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    const t = Math.min(1, Math.max(0, (y - y0) / (2 * FEATHER)))
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const k = y >= y0 ? mask[(y - y0) * w + x] : 0
      for (let c = 0; c < 3; c++) {
        const d = D.data[i + c] * (1 + (gain[c] - 1) * k)
        out.data[i + c] = P.data[i + c] * (1 - t) + Math.min(255, d) * t
      }
      out.data[i + 3] = P.data[i + 3] * (1 - t) + D.data[i + 3] * t
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.putImageData(out, 0, 0)
  return canvas
}
