const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * SVG progress ring for the display screen's timer. Amber above 5s, shifts to
 * pink and pulses under 3s — pure CSS/SVG, no animation library needed.
 */
export function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const progress = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0
  const offset = CIRCUMFERENCE * (1 - progress)
  const urgent = seconds <= 5
  const critical = seconds <= 3

  return (
    <div
      className={`relative h-32 w-32 shrink-0 rounded-full transition-[filter] duration-300 ${critical ? 'anim-urgent' : ''}`}
      style={urgent ? { filter: `drop-shadow(0 0 ${critical ? 18 : 10}px ${critical ? 'rgba(235,84,124,0.85)' : 'rgba(249,212,123,0.7)'})` } : undefined}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#282828" strokeWidth="10" opacity={0.3} />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={urgent ? '#EB547C' : '#F9D47B'}
          strokeWidth="10"
          strokeLinecap="square"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-3xl font-bold tabular-nums text-brand-white">
        {seconds}
      </span>
    </div>
  )
}
