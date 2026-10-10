'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'

/**
 * Landing loader (~3.6 s, once per session): the batsman plays the same 42-frame swing as
 * SoldCelebration (wind-up eased into contact, follow-through into frame 42, the IPL logo pose),
 * hits the ball for six, the logo glows and "INDIAN PREMIER LEAGUE" slams in beside it; then
 * the screen splits open onto the hero.
 * One GSAP timeline with labels: intro -> ballIn -> hit -> six -> logo -> settle -> exit.
 *
 * Vector data: public/assets/brand/ipl-loader.json from scripts/build_ipl_loader.py (the swing
 * frames traced to vectors so they stay crisp, the official logo's wordmark lines, the contact
 * point). Everything is laid out in the official logo's own units.
 *
 * Repeat visits never see it: app/layout.tsx marks <html class="loader-skip"> before first
 * paint when sessionStorage has LOADER_SEEN, and globals.css hides #ipl-loader.
 * Reduced motion gets a 0.8 s logo fade, then the exit.
 * The hero's backdrop (`[data-hero-bg]`) scales 1.1 -> 1 as the panels open.
 */
export const LOADER_SEEN = 'ipl-loader'
const SPARKS = 14
const BLUE = '#1E4FFF'
const WIND_UP = 0.6 // guard tap, backlift, downswing into contact, across the ball's whole flight
const FOLLOW = 0.55 // contact -> frame 42 (the logo pose)
// frame 42's swoosh is drawn wider than the official mark; shift the swing left so it keeps
// the official gap (1.17 units) before the wordmark instead of touching the "I"
const SWING_SHIFT = -1.1
type OfficialPath = { d: string; transform: string }
type Data = {
  group: string
  mark: (OfficialPath & { part: 'body' | 'swoosh' })[]
  markBox: number[]
  lines: { text: string; box: number[]; paths: OfficialPath[] }[]
  frames: string[]
  viewBox: number[]
  contactFrame: number
  contact: number[]
}

// the lockup box: the official logo minus the (R) mark, in its viewBox units
const LOGO_W = 38.2335
const LOGO_H = 19.695
const place = ([x, y, w, h]: number[]): CSSProperties => ({
  position: 'absolute',
  left: `${(x / LOGO_W) * 100}%`,
  top: `${(y / LOGO_H) * 100}%`,
  width: `${(w / LOGO_W) * 100}%`,
  height: `${(h / LOGO_H) * 100}%`,
})

export function Loader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const done = useRef(onDone) // a ref, so a new onDone each parent render doesn't restart the loader
  useEffect(() => {
    done.current = onDone
  }, [onDone])
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    let seen = false
    try {
      seen = !!sessionStorage.getItem(LOADER_SEEN)
    } catch {}
    if (seen) return done.current()
    fetch('/assets/brand/ipl-loader.json')
      .then((r) => r.json())
      .then(setData)
      .catch(() => done.current())
  }, [])

  useEffect(() => {
    if (!data) return
    const body = document.body
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden' // lock scroll while the loader is up

    const finish = () => {
      try {
        sessionStorage.setItem(LOADER_SEEN, '1')
      } catch {}
      body.style.overflow = prevOverflow
      done.current()
    }

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root)
      const content = q('[data-content]')[0]
      const swingSvg = q('[data-swing]')[0] as unknown as SVGSVGElement
      const swing = q('[data-swing] path')[0]
      const ball = q('[data-ball]')[0]
      const hero = document.querySelector('[data-hero-bg]')
      const counter = q('[data-counter]')[0]
      const count = { v: 0 }
      const frame = { f: 0 }
      const setCount = () => (counter.textContent = `${String(Math.round(count.v)).padStart(3, '0')}%`)
      // frames 19-21 lift the bat back up behind the head after contact (a second backlift that
      // made the hit land mid-swing); skip them so contact runs straight into the follow-through
      const seq = data.frames.filter((_, i) => i <= data.contactFrame || i > data.contactFrame + 3)
      const setFrame = () => swing.setAttribute('d', seq[Math.round(frame.f)])

      // the contact point on screen: viewBox units -> px, measured before anything moves
      const r = swingSvg.getBoundingClientRect()
      const [vx, vy, vw] = data.viewBox
      const k = r.width / vw
      const contact = { x: r.left + (data.contact[0] - vx) * k, y: r.top + (data.contact[1] - vy) * k }

      gsap.set(content, { autoAlpha: 1 }) // SSR renders it hidden so nothing flashes before this
      gsap.set(swingSvg, { autoAlpha: 0 })
      gsap.set(q('[data-line]'), { yPercent: 110 })
      gsap.set(q('[data-sub]'), { autoAlpha: 0, letterSpacing: '1.2em' })
      gsap.set(q('[data-hair]'), { scaleX: 0, transformOrigin: '0% 50%' })
      gsap.set([ball, q('[data-ring]')[0], q('[data-spark]')], { autoAlpha: 0 })
      gsap.set(q('[data-fx]'), { x: contact.x, y: contact.y }) // ring + sparks are born at the contact point

      const exit = (tl: gsap.core.Timeline) => {
        tl.addLabel('exit')
          .to(content, { autoAlpha: 0, duration: 0.25, ease: 'power2.in' }, 'exit')
          .to(q('[data-panel="top"]'), { yPercent: -100, duration: 0.6, ease: 'expo.inOut' }, 'exit+=0.05')
          .to(q('[data-panel="bottom"]'), { yPercent: 100, duration: 0.6, ease: 'expo.inOut' }, 'exit+=0.05')
        if (hero) tl.fromTo(hero, { scale: 1.1 }, { scale: 1, duration: 1.2, ease: 'power2.out', clearProps: 'transform' }, 'exit+=0.1')
      }

      // reduced motion: the logo fades in, holds, the panels open
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const tl = gsap.timeline({ onComplete: finish })
        gsap.set(q('[data-line]'), { yPercent: 0 })
        frame.f = seq.length - 1
        setFrame() // the logo pose
        tl.to([swingSvg, q('[data-word]')[0]], { autoAlpha: 1, duration: 0.4 }).to({}, { duration: 0.4 })
        exit(tl)
        return
      }

      const start = { x: window.innerWidth + 60, y: contact.y + r.height * 0.06 } // off the right edge, a touch low
      const sixTo = { x: window.innerWidth * 0.92, y: window.innerHeight * 0.06 } // deep into the top-right
      const angle = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI

      const tl = gsap.timeline({ onComplete: finish })

      // the counter runs 0 -> 100 across the first 3 s, in sync with everything below
      tl.to(count, { v: 100, duration: 3, ease: 'power1.inOut', onUpdate: setCount }, 0)

      // 1. 0.0-0.6s  intro: a hairline draws across the centre, the corner text fades up
      tl.addLabel('intro', 0)
        .to(q('[data-hair]'), { scaleX: 1, duration: 0.6, ease: 'power3.inOut' }, 'intro')
        .from(q('[data-corner]'), { autoAlpha: 0, y: 8, duration: 0.4, stagger: 0.08 }, 'intro+=0.1')

      // the swing: the frames already pace the tap, backlift and downswing, so they play evenly and
      // the contact frame lands exactly on 'hit'; the follow-through decelerates into the logo pose
      const last = seq.length - 1
      const swingAt = 1.2 - WIND_UP

      // 2. 0.6-1.2s  ballIn: the batsman fades in at guard and starts the swing; the ball streaks
      //    in from the right and arrives on the contact frame
      tl.addLabel('ballIn', 0.6)
        .to(q('[data-hair]'), { autoAlpha: 0.25, duration: 0.4 }, 'ballIn')
        .to(swingSvg, { autoAlpha: 1, duration: 0.2 }, 'ballIn-=0.2') // at guard before the backlift
        .to(frame, { f: data.contactFrame, duration: WIND_UP, ease: 'none', onUpdate: setFrame }, swingAt)
        .to(frame, { f: last, duration: FOLLOW, ease: 'power2.out', onUpdate: setFrame }, 1.2)
        .set(ball, { x: start.x, y: start.y, rotation: angle(start, contact), autoAlpha: 1 }, 'ballIn+=0.1')
        .to(ball, { x: contact.x, y: contact.y, duration: 0.5, ease: 'power1.in' }, 'ballIn+=0.1')

      // 3. 1.2s  hit: a 60 ms freeze on contact, blue shockwave, sparks, a 150 ms shake
      tl.addLabel('hit', 1.2)
        .add(() => {
          tl.pause()
          gsap.delayedCall(0.06, () => tl.resume()) // freeze-frame
        }, 'hit')
        .fromTo(q('[data-ring]'), { autoAlpha: 1, scale: 0 }, { autoAlpha: 0, scale: 5, duration: 0.5, ease: 'power2.out', immediateRender: false }, 'hit')
        .to(content, { keyframes: { x: [3, -3, 2, -2, 0], y: [-2, 2, -1, 1, 0] }, duration: 0.15, ease: 'none' }, 'hit')
      q('[data-spark]').forEach((s) => {
        const a = gsap.utils.random(0, Math.PI * 2)
        const d = gsap.utils.random(40, 120)
        tl.fromTo(
          s,
          { autoAlpha: 1, x: 0, y: 0, rotation: (a * 180) / Math.PI, scaleX: 1 },
          // immediateRender off: fromTo would otherwise show its "from" (visible) state at load
          { autoAlpha: 0, x: Math.cos(a) * d, y: Math.sin(a) * d, scaleX: 0.2, duration: gsap.utils.random(0.35, 0.6), ease: 'power3.out', immediateRender: false },
          'hit',
        )
      })

      // 4. 1.2-2.1s  six: the bat whips through and the swoosh forms (the rest of the swing)
      //    while the ball sails into the top-right, shrinking into the distance
      tl.addLabel('six', 1.2)
        .set(ball, { rotation: angle(contact, sixTo) }, 'six')
        .to(ball, { x: sixTo.x, y: sixTo.y, scale: 0.15, duration: 0.9, ease: 'power2.out' }, 'six')
        .to(ball, { autoAlpha: 0, duration: 0.25 }, 'six+=0.7')

      // 5. ~1.65s  logo: the swing has landed on the logo pose; it glows, the wordmark slams in
      const logoAt = 1.2 + FOLLOW
      tl.addLabel('logo', logoAt)
        .fromTo(q('[data-bloom]'), { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 0.5, scale: 1.1, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, 'logo')
        .to(q('[data-line]'), { yPercent: 0, duration: 0.7, stagger: 0.1, ease: 'expo.out' }, 'logo')

      // 6. 2.4-3.0s  settle: counter lands on 100%, the subtitle tightens in from wide tracking
      tl.addLabel('settle', 2.4).to(q('[data-sub]'), { autoAlpha: 1, letterSpacing: '0.35em', duration: 0.6, ease: 'power3.out' }, 'settle')

      // 7. 3.0-3.6s  exit: top + bottom panels part (expo.inOut); hero backdrop settles 1.1 -> 1
      tl.set({}, {}, 3.0)
      exit(tl)
    }, root)

    return () => {
      ctx.revert() // kills the timeline + delayed calls, restores every inline style (Strict Mode safe)
      body.style.overflow = prevOverflow
    }
  }, [data])

  return (
    <div id="ipl-loader" ref={root} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      {/* the two halves that part on exit; they are the black background until then */}
      <div data-panel="top" className="absolute inset-x-0 top-0 h-1/2 bg-black" />
      <div data-panel="bottom" className="absolute inset-x-0 bottom-0 h-1/2 bg-black" />

      <div data-content className="invisible absolute inset-0 font-mono uppercase text-white">
        <div data-hair className="absolute inset-x-0 top-1/2 h-px bg-white/40" />

        {/* centre lockup in the official logo's proportions: mark left, wordmark right */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {data && (
            <div className="relative aspect-[38.2335/19.695] w-[min(86vw,620px)]">
              <div
                data-bloom
                className="absolute rounded-full opacity-0"
                style={{ ...place([data.markBox[0] - 3, data.markBox[1] - 1, data.markBox[2] + 6, data.markBox[3] + 2]), background: 'radial-gradient(closest-side, rgba(255,255,255,0.5) 0%, rgba(30,79,255,0.35) 45%, transparent 100%)' }}
              />
              {/* the swing: one path, its d swapped frame by frame; frame 42 is the logo */}
              <svg
                data-swing
                viewBox={data.viewBox.join(' ')}
                style={place([data.viewBox[0] + SWING_SHIFT, ...data.viewBox.slice(1)])}
                className="overflow-visible drop-shadow-[0_0_18px_rgba(30,79,255,0.45)]"
                fillRule="evenodd"
              >
                <path d={data.frames[0]} fill="#fff" />
              </svg>
              {/* the official wordmark, one clipped line at a time */}
              <div data-word>
                {data.lines.map((l) => (
                  <div key={l.text} className="overflow-hidden" style={place(l.box)}>
                    <svg data-line viewBox={l.box.join(' ')} className="block h-full w-full overflow-visible">
                      <g transform={data.group}>
                        {l.paths.map((p, i) => (
                          <path key={i} d={p.d} transform={p.transform} fill="#fff" />
                        ))}
                      </g>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div data-sub className="mt-[clamp(14px,3vw,28px)] text-[clamp(11px,1.6vw,15px)] tracking-[0.35em] text-white/80">
            IPL Auction
          </div>
        </div>

        <div data-corner className="absolute bottom-6 left-6 text-[10px] tracking-[0.3em] text-white/60 sm:bottom-8 sm:left-10 sm:text-xs">
          IPL Auction 2024
        </div>
        <div data-corner data-counter className="absolute bottom-6 right-6 text-[10px] tabular-nums tracking-[0.3em] text-white/60 sm:bottom-8 sm:right-10 sm:text-xs">
          000%
        </div>

        {/* ball: white leather with a trailing streak; the wrapper is rotated to face its travel */}
        <div data-ball className="absolute left-0 top-0 -ml-[7px] -mt-[7px]">
          <div className="absolute right-[7px] top-1/2 h-[6px] w-[120px] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-[rgba(30,79,255,0.35)] to-white/80 blur-[2px]" />
          <div className="h-[14px] w-[14px] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9),0_0_28px_rgba(30,79,255,0.8)]" />
        </div>

        {/* contact effects, positioned at the contact point by the timeline */}
        <div data-fx className="absolute left-0 top-0">
          <div
            data-ring
            className="absolute -left-6 -top-6 h-12 w-12 rounded-full border-2"
            style={{ borderColor: BLUE, boxShadow: `0 0 16px ${BLUE}, inset 0 0 12px ${BLUE}` }}
          />
        </div>
        <div data-fx className="absolute left-0 top-0">
          {Array.from({ length: SPARKS }, (_, i) => (
            <span
              key={i}
              data-spark
              className="absolute -mt-px h-[2px] w-3 origin-left rounded-full"
              style={{ background: i % 3 ? '#fff' : BLUE, boxShadow: `0 0 6px ${i % 3 ? '#fff' : BLUE}` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
