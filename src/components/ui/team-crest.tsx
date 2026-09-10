import { cn } from '@/lib/cn'

/**
 * Franchise crests, in three tiers:
 *
 * 1. `logoUrl` set on the team — that file is rendered as-is. This is the hook
 *    for real franchise artwork: drop a file in /public/logos and point the
 *    Team row at it. Nothing licensed ships in this repo.
 * 2. A hand-drawn crest registered for the short code (MI, RCB).
 * 3. Otherwise the shell plus that team's caricature motif — an original
 *    exaggerated-geometry emblem, drawn in gold on the franchise colour, so
 *    every tile reads as a distinct club rather than ten identical badges.
 *
 * `mark` crops to the emblem alone — no panels, no typography — for the small
 * tiles in the team bid tracker where text would be unreadable.
 */

type CrestProps = {
  shortCode: string
  name: string
  colorAccent: string
  logoUrl?: string | null
  mark?: boolean
  className?: string
}

export function TeamCrest({ shortCode, name, colorAccent, logoUrl, mark, className }: CrestProps) {
  if (logoUrl) {
    // RR's file is drawn in the same pink as the team's own tile background —
    // a thin white edge outline (not a background plate) keeps every other
    // team's crest pure SVG while making RR's actually visible.
    const rrOutline =
      shortCode === 'RR'
        ? '[filter:drop-shadow(1px_0_0_white)_drop-shadow(-1px_0_0_white)_drop-shadow(0_1px_0_white)_drop-shadow(0_-1px_0_white)]'
        : ''
    return (
      // eslint-disable-next-line @next/next/no-img-element -- caller-supplied logo file, no next/image domain config
      <img src={logoUrl} alt={`${name} logo`} className={cn('block object-contain', rrOutline, className)} />
    )
  }
  const Crest = CRESTS[shortCode] ?? MotifCrest
  return <Crest shortCode={shortCode} name={name} colorAccent={colorAccent} mark={mark} className={className} />
}

function Frame({
  viewBox,
  label,
  className,
  children,
}: {
  viewBox: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <svg viewBox={viewBox} className={cn('block', className)} role="img" aria-label={`${label} crest`}>
      {children}
    </svg>
  )
}

/* ── Caricature motifs ──────────────────────────────────────────────────────
 * Each motif draws inside a 0 0 200 200 box and is placed by the shell. Big
 * blunt shapes only: they have to survive being 60px wide in a tracker tile.
 * `gold` is the shell's gradient id, `accent` the franchise colour.
 */
type Motif = (gold: string, accent: string) => React.ReactNode

/**
 * Spike ring for the mane / sun-ray motifs. Coordinates are rounded: an
 * unrounded float prints with different precision on the server than in the
 * browser, which React reports as a hydration mismatch.
 */
function spikes(count: number, cx: number, cy: number, radius: number, from: number, sweep: number, width: number) {
  const r = (n: number) => Math.round(n * 100) / 100
  return Array.from({ length: count }, (_, i) => {
    const a = from + (i / count) * sweep
    return `M ${cx},${cy} L ${r(cx + Math.cos(a) * radius)},${r(cy + Math.sin(a) * radius)} L ${r(cx + Math.cos(a + width) * radius)},${r(cy + Math.sin(a + width) * radius)} Z`
  })
}

/** Lion head, mane as spikes — Chennai. */
const lionHead: Motif = (gold) => (
  <>
    {spikes(12, 100, 100, 92, 0, Math.PI * 2, 0.26).map((d) => (
      <path key={d} d={d} fill={`url(#${gold})`} />
    ))}
    <circle cx="100" cy="100" r="58" fill={`url(#${gold})`} />
    <circle cx="100" cy="100" r="58" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <path d="M 74,88 h 22 M 104,88 h 22" stroke="#0A0A0A" strokeWidth="9" strokeLinecap="round" />
    <path d="M 88,120 q 12,14 24,0" stroke="#0A0A0A" strokeWidth="7" fill="none" strokeLinecap="round" />
    <path d="M 92,104 h 16 l -8,10 Z" fill="#0A0A0A" />
  </>
)

/** Knight's helmet with a plume — Kolkata. */
const knightHelm: Motif = (gold) => (
  <>
    <path d="M 100,18 C 118,34 122,52 112,66 L 88,66 C 78,52 82,34 100,18 Z" fill={`url(#${gold})`} />
    <path d="M 62,70 h 76 c 10,0 14,10 14,24 v 48 c 0,26 -22,44 -52,44 s -52,-18 -52,-44 V 94 c 0,-14 4,-24 14,-24 Z" fill={`url(#${gold})`} />
    <path d="M 62,70 h 76 c 10,0 14,10 14,24 v 48 c 0,26 -22,44 -52,44 s -52,-18 -52,-44 V 94 c 0,-14 4,-24 14,-24 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <rect x="52" y="104" width="96" height="16" fill="#0A0A0A" />
    <rect x="52" y="132" width="96" height="12" fill="#0A0A0A" />
  </>
)

/** Spread wings over a shield — Delhi. */
const wingedShield: Motif = (gold) => (
  <>
    <path d="M 100,54 C 74,40 40,42 12,58 C 40,66 62,72 92,78 Z" fill={`url(#${gold})`} />
    <path d="M 100,54 C 126,40 160,42 188,58 C 160,66 138,72 108,78 Z" fill={`url(#${gold})`} />
    <path d="M 100,62 L 152,84 V 132 C 152,160 128,178 100,188 C 72,178 48,160 48,132 V 84 Z" fill={`url(#${gold})`} />
    <path d="M 100,62 L 152,84 V 132 C 152,160 128,178 100,188 C 72,178 48,160 48,132 V 84 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <path d="M 100,86 L 128,100 v 28 c 0,16 -14,28 -28,34 c -14,-6 -28,-18 -28,-34 v -28 Z" fill="#0A0A0A" />
  </>
)

/** Rising sun over a horizon — Hyderabad. */
const risingSun: Motif = (gold) => (
  <>
    {spikes(9, 100, 132, 94, Math.PI, Math.PI, 0.18).map((d) => (
      <path key={d} d={d} fill={`url(#${gold})`} />
    ))}
    <path d="M 40,132 a 60,60 0 0 1 120,0 Z" fill={`url(#${gold})`} />
    <path d="M 40,132 a 60,60 0 0 1 120,0 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <rect x="14" y="140" width="172" height="12" fill="#0A0A0A" />
    <rect x="34" y="160" width="132" height="10" fill="#0A0A0A" />
  </>
)

/** Crown over crossed bats — Punjab. */
const crownAndBats: Motif = (gold) => (
  <>
    <path d="M 44,40 L 68,96 L 100,44 L 132,96 L 156,40 L 168,120 H 32 Z" fill={`url(#${gold})`} />
    <path d="M 44,40 L 68,96 L 100,44 L 132,96 L 156,40 L 168,120 H 32 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <rect x="32" y="124" width="136" height="16" fill="#0A0A0A" />
    <g stroke={`url(#${gold})`} strokeWidth="16" strokeLinecap="round">
      <path d="M 62,192 L 118,146" />
      <path d="M 138,192 L 82,146" />
    </g>
    <circle cx="100" cy="72" r="9" fill="#0A0A0A" />
  </>
)

/** Crown with a set gem — Rajasthan. */
const jewelCrown: Motif = (gold) => (
  <>
    <path d="M 26,64 L 62,116 L 100,52 L 138,116 L 174,64 L 182,150 H 18 Z" fill={`url(#${gold})`} />
    <path d="M 26,64 L 62,116 L 100,52 L 138,116 L 174,64 L 182,150 H 18 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <rect x="18" y="154" width="164" height="20" fill="#0A0A0A" />
    <path d="M 100,96 L 118,116 L 100,140 L 82,116 Z" fill="#0A0A0A" />
    <circle cx="26" cy="58" r="10" fill={`url(#${gold})`} />
    <circle cx="174" cy="58" r="10" fill={`url(#${gold})`} />
  </>
)

/** Star burst inside a shield — Gujarat. */
const starShield: Motif = (gold) => (
  <>
    <path d="M 100,14 L 176,48 V 122 C 176,162 142,184 100,196 C 58,184 24,162 24,122 V 48 Z" fill={`url(#${gold})`} />
    <path d="M 100,14 L 176,48 V 122 C 176,162 142,184 100,196 C 58,184 24,162 24,122 V 48 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
    <path
      d="M 100,52 L 114,92 L 156,92 L 122,116 L 134,156 L 100,132 L 66,156 L 78,116 L 44,92 L 86,92 Z"
      fill="#0A0A0A"
    />
  </>
)

/** Flame wing — Lucknow. */
const flameWing: Motif = (gold) => (
  <>
    <path
      d="M 100,10 C 132,54 150,86 146,120 C 142,158 120,182 100,192 C 80,182 58,158 54,120 C 50,86 68,54 100,10 Z"
      fill={`url(#${gold})`}
    />
    <path
      d="M 100,10 C 132,54 150,86 146,120 C 142,158 120,182 100,192 C 80,182 58,158 54,120 C 50,86 68,54 100,10 Z"
      fill="none"
      stroke="#0A0A0A"
      strokeWidth="5"
    />
    <path d="M 100,66 C 118,98 126,120 122,140 C 118,160 108,172 100,178 C 92,172 82,160 78,140 C 74,120 82,98 100,66 Z" fill="#0A0A0A" />
    <path d="M 16,104 C 44,92 58,96 66,108 C 48,116 32,118 16,104 Z" fill={`url(#${gold})`} />
    <path d="M 184,104 C 156,92 142,96 134,108 C 152,116 168,118 184,104 Z" fill={`url(#${gold})`} />
  </>
)

/** Anything unregistered: the short code's initial on a plate. */
const initialPlate: Motif = (gold) => (
  <>
    <path d="M 100,16 L 178,52 V 126 C 178,164 142,186 100,196 C 58,186 22,164 22,126 V 52 Z" fill={`url(#${gold})`} />
    <path d="M 100,16 L 178,52 V 126 C 178,164 142,186 100,196 C 58,186 22,164 22,126 V 52 Z" fill="none" stroke="#0A0A0A" strokeWidth="5" />
  </>
)

const MOTIFS: Record<string, Motif> = {
  CSK: lionHead,
  KKR: knightHelm,
  DC: wingedShield,
  SRH: risingSun,
  PBKS: crownAndBats,
  RR: jewelCrown,
  GT: starShield,
  LSG: flameWing,
}

/**
 * The shell every motif crest shares: framed panel in the franchise colour,
 * carbon lower half, short code and split name. Team branding is the accent
 * and the motif only — the geometry never changes.
 */
function MotifCrest({ shortCode, name, colorAccent, mark, className }: CrestProps) {
  const uid = `crest-${shortCode}`
  const gold = `${uid}-gold`
  const carbon = `${uid}-carbon`
  const shadow = `${uid}-shadow`
  const motif = MOTIFS[shortCode] ?? initialPlate
  const words = name.toUpperCase().split(' ')
  const lastWord = words.length > 1 ? words[words.length - 1] : null
  const leadWords = lastWord ? words.slice(0, -1).join(' ') : words.join(' ')

  return (
    <Frame viewBox={mark ? '90 40 220 220' : '0 0 400 450'} label={name} className={className}>
      <defs>
        <linearGradient id={gold} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="30%" stopColor="#FFC107" />
          <stop offset="70%" stopColor="#FFB300" />
          <stop offset="100%" stopColor="#B58900" />
        </linearGradient>
        <linearGradient id={carbon} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#212121" />
          <stop offset="100%" stopColor="#0F0F0F" />
        </linearGradient>
        <filter id={shadow} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {!mark && (
        <>
          <rect x="5" y="5" width="390" height="440" rx="4" fill="none" stroke="#111111" strokeWidth="10" />
          <rect x="10" y="10" width="380" height="280" fill={colorAccent} />
          <rect x="10" y="290" width="380" height="150" fill={`url(#${carbon})`} />
          <rect x="10" y="287" width="380" height="4" fill={`url(#${gold})`} />
        </>
      )}

      <g transform="translate(100, 50)" filter={`url(#${shadow})`}>
        {motif(gold, colorAccent)}
      </g>

      {/* No motif of its own: the initial carries the plate. */}
      {!MOTIFS[shortCode] && (
        <text
          x="200"
          y="188"
          fontFamily="'Arial Black', Impact, sans-serif"
          fontSize="86"
          fontWeight="900"
          fill="#0A0A0A"
          textAnchor="middle"
        >
          {shortCode.slice(0, 2)}
        </text>
      )}

      {!mark && (
        <>
          <text
            x="200"
            y="345"
            fontFamily="'Arial Black', Impact, sans-serif"
            fontSize="36"
            fontWeight="900"
            fill={`url(#${gold})`}
            textAnchor="middle"
            letterSpacing="4"
          >
            {shortCode}
          </text>
          <text
            x="200"
            y="380"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            fontSize="13"
            fontWeight="bold"
            fill="#FFFFFF"
            textAnchor="middle"
            letterSpacing="3"
          >
            {leadWords}
          </text>
          {lastWord && (
            <text
              x="200"
              y="405"
              fontFamily="'Helvetica Neue', Arial, sans-serif"
              fontSize="12"
              fontWeight="bold"
              fill="#E0E0E0"
              textAnchor="middle"
              letterSpacing="5"
            >
              {lastWord}
            </text>
          )}
        </>
      )}
    </Frame>
  )
}

/** Mumbai Indians: Sudarshan chakra over the tilted oval badge. */
function MumbaiIndiansCrest({ shortCode, name, mark, className }: CrestProps) {
  const uid = `mi-${shortCode}`
  const gloss = `${uid}-gloss`
  const chakra = `${uid}-chakra`
  const glow = `${uid}-glow`
  const shadow = `${uid}-shadow`

  return (
    <Frame viewBox={mark ? '280 105 220 220' : '0 0 800 600'} label={name} className={className}>
      <defs>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0066cc" />
          <stop offset="100%" stopColor="#0033aa" />
        </radialGradient>
        <linearGradient id={gloss} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#F0F0F0" />
          <stop offset="60%" stopColor="#D0D0D0" />
          <stop offset="100%" stopColor="#999999" />
        </linearGradient>
        <linearGradient id={chakra} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF59D" />
          <stop offset="50%" stopColor="#FBC02D" />
          <stop offset="100%" stopColor="#F57F17" />
        </linearGradient>
        <filter id={shadow} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.6" />
        </filter>
      </defs>

      {!mark && <rect width="800" height="600" fill={`url(#${glow})`} />}

      <g filter={`url(#${shadow})`}>
        {!mark && (
          <>
            <ellipse
              cx="400"
              cy="220"
              rx="190"
              ry="85"
              fill="#FFFFFF"
              stroke="#003399"
              strokeWidth="3"
              transform="rotate(-7, 400, 220)"
            />
            <ellipse
              cx="400"
              cy="220"
              rx="175"
              ry="73"
              fill="none"
              stroke="#00A654"
              strokeWidth="4"
              strokeDasharray="400 60"
              transform="rotate(-7, 400, 220)"
            />
          </>
        )}

        <g transform="translate(390, 215) scale(1.1) rotate(-5)">
          {/* Razor blades first, so the gold core sits on top of them. */}
          {CHAKRA_BLADES.map(([angle, fill]) => (
            <path
              key={angle}
              d="M-15,-5 C 20,-45 80,-30 110,10 C 60,10 20,-5 -15,-5 Z"
              fill={fill === 'gold' ? `url(#${chakra})` : fill}
              transform={`rotate(${angle})`}
            />
          ))}
          <ellipse cx="0" cy="0" rx="25" ry="14" fill={`url(#${chakra})`} transform="rotate(-15)" />
          <ellipse cx="0" cy="0" rx="12" ry="7" fill="#FFFFFF" transform="rotate(-15)" />
        </g>

        {!mark && (
          <>
            <text
              x="540"
              y="295"
              fontFamily="'Arial Black', Impact, sans-serif"
              fontSize="34"
              fontWeight="900"
              fontStyle="italic"
              textAnchor="middle"
              fill="#FFFFFF"
              stroke="#0D47A1"
              strokeWidth="6"
              paintOrder="stroke fill"
            >
              MUMBAI
            </text>
            {/* Three stacked passes: blue outline, red accent, glossy face. */}
            {[
              { fill: '#0D47A1', stroke: '#0D47A1', width: 18 },
              { fill: '#0D47A1', stroke: '#E53935', width: 10 },
              { fill: `url(#${gloss})`, stroke: '#FFFFFF', width: 2 },
            ].map((pass) => (
              <text
                key={pass.width}
                x="400"
                y="375"
                fontFamily="'Arial Black', Impact, sans-serif"
                fontSize="92"
                fontWeight="900"
                fontStyle="italic"
                textAnchor="middle"
                fill={pass.fill}
                stroke={pass.stroke}
                strokeWidth={pass.width}
                strokeLinejoin="round"
              >
                INDIANS
              </text>
            ))}
          </>
        )}
      </g>

      {!mark && (
        <text
          x="400"
          y="540"
          fontFamily="'Arial Black', sans-serif"
          fontSize="22"
          fontWeight="900"
          textAnchor="middle"
          letterSpacing="2"
          fill="#FFFFFF"
        >
          DUNIYA HILA DENGE <tspan fill="#FFEB3B">HUM..</tspan>
        </text>
      )}
    </Frame>
  )
}

const CHAKRA_BLADES: [number, string][] = [
  [0, '#E53935'],
  [30, '#FF6D00'],
  [75, 'gold'],
  [120, '#FFEB3B'],
  [190, '#0D47A1'],
  [240, '#1976D2'],
  [300, '#00A654'],
]

/** Rampant lion — Royal Challengers Bengaluru's own emblem. */
function LionCrest({ shortCode, name, colorAccent, mark, className }: CrestProps) {
  const uid = `lion-${shortCode}`
  const gold = `${uid}-gold`
  const ribbon = `${uid}-ribbon`
  const carbon = `${uid}-carbon`
  const shadow = `${uid}-shadow`
  const words = name.toUpperCase().split(' ')
  const lastWord = words.length > 1 ? words[words.length - 1] : null
  const leadWords = lastWord ? words.slice(0, -1).join(' ') : words.join(' ')

  return (
    <Frame viewBox={mark ? '110 10 180 290' : '0 0 400 450'} label={name} className={className}>
      <defs>
        <linearGradient id={gold} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="30%" stopColor="#FFC107" />
          <stop offset="70%" stopColor="#FFB300" />
          <stop offset="100%" stopColor="#B58900" />
        </linearGradient>
        <linearGradient id={ribbon} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFE57F" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
        <linearGradient id={carbon} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#212121" />
          <stop offset="100%" stopColor="#0F0F0F" />
        </linearGradient>
        <filter id={shadow} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {!mark && (
        <>
          <rect x="5" y="5" width="390" height="440" rx="4" fill="none" stroke="#111111" strokeWidth="10" />
          <rect x="10" y="10" width="380" height="280" fill={colorAccent} />
          <rect x="10" y="290" width="380" height="150" fill={`url(#${carbon})`} />
          <rect x="10" y="287" width="380" height="4" fill={`url(#${gold})`} />
        </>
      )}

      <g filter={`url(#${shadow})`}>
        <path d="M 175,45 L 200,20 L 225,45 L 212,50 L 200,38 L 188,50 Z" fill={`url(#${gold})`} />
        <path d="M 170,85 C 150,75 140,85 145,95 C 155,100 165,95 175,105 Z" fill={`url(#${gold})`} />
        <path d="M 180,65 C 160,50 155,65 165,75 C 170,80 180,75 185,85 Z" fill={`url(#${gold})`} />
        <path
          d="M 200,50
             C 180,60 175,80 185,110
             C 190,120 180,145 170,150
             C 150,140 140,160 155,175
             C 170,185 185,180 195,195
             C 215,195 230,195 240,185
             C 255,160 250,130 235,105
             C 245,85 240,65 220,55 Z"
          fill={`url(#${gold})`}
        />
        <path d="M 235,115 C 275,110 290,75 270,60 C 255,75 260,95 240,110 Z" fill={`url(#${gold})`} />
        <path d="M 185,120 C 135,120 115,85 130,70 C 145,85 150,105 175,115 Z" fill={`url(#${gold})`} />
        <path d="M 140,195 Q 200,235 260,195 L 250,215 Q 200,250 150,215 Z" fill={`url(#${ribbon})`} />
        <path
          d="M 155,210 Q 200,242 245,210 L 245,265 Q 200,295 155,265 Z"
          fill="#0A0A0A"
          stroke={`url(#${gold})`}
          strokeWidth="2"
        />
        <path d="M 180,225 Q 200,215 220,225 L 215,250 Q 200,265 185,250 Z" fill={`url(#${gold})`} opacity="0.85" />
      </g>

      {!mark && (
        <>
          <text
            x="200"
            y="345"
            fontFamily="'Arial Black', Impact, sans-serif"
            fontSize="36"
            fontWeight="900"
            fill={`url(#${gold})`}
            textAnchor="middle"
            letterSpacing="4"
          >
            {shortCode}
          </text>
          <text
            x="200"
            y="380"
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            fontSize="13"
            fontWeight="bold"
            fill="#FFFFFF"
            textAnchor="middle"
            letterSpacing="3"
          >
            {leadWords}
          </text>
          {lastWord && (
            <text
              x="200"
              y="405"
              fontFamily="'Helvetica Neue', Arial, sans-serif"
              fontSize="12"
              fontWeight="bold"
              fill="#E0E0E0"
              textAnchor="middle"
              letterSpacing="5"
            >
              {lastWord}
            </text>
          )}
        </>
      )}
    </Frame>
  )
}

/** Per-team full crests. Everything else uses MotifCrest + its motif. */
const CRESTS: Record<string, (props: CrestProps) => React.ReactElement> = {
  MI: MumbaiIndiansCrest,
  RCB: LionCrest,
}
