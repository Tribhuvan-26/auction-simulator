'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Mesh, MeshStandardMaterial, PerspectiveCamera, WebGLRenderer } from 'three'
import { cn } from '@/lib/cn'

type Model3DProps = {
  /** .glb built by blender/build_models.py — framing comes from its camera. */
  src: string
  loop?: boolean
  /** Painted onto the "Logo"/"LogoBack" materials (the team coin). */
  logoUrl?: string
  logoBg?: string
  /** Fires once when a non-looping clip ends. */
  onDone?: () => void
  /** Shown until the model renders, and kept if WebGL is unavailable. */
  fallback?: ReactNode
  className?: string
}

/**
 * Plays a Blender-exported glTF with its baked camera and animation.
 * three.js is imported on mount so it stays out of the page bundle and SSR.
 */
export function Model3D({ src, loop, logoUrl, logoBg = '#ffffff', onDone, fallback, className }: Model3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/environments/RoomEnvironment.js'),
      ])
      if (cancelled) return

      let renderer: WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      } catch {
        return // no WebGL (old device, tests): the fallback stays up
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.NeutralToneMapping

      const scene = new THREE.Scene()
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      const key = new THREE.DirectionalLight(0xffffff, 2)
      key.position.set(3, -4, 6)
      scene.add(key)

      let gltf
      try {
        gltf = await new GLTFLoader().loadAsync(src)
      } catch {
        renderer.dispose()
        return
      }
      if (cancelled) {
        renderer.dispose()
        return
      }
      scene.add(gltf.scene)

      if (logoUrl) {
        const img = new Image()
        img.src = logoUrl
        await img.decode().catch(() => {})
        const size = 1024
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = logoBg
        ctx.fillRect(0, 0, size, size)
        if (img.naturalWidth || img.width) {
          const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1)
          const box = size * 0.74 // fills the face, clear of the rim
          const w = ratio >= 1 ? box : box * ratio
          const h = ratio >= 1 ? box / ratio : box
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        }
        const tex = new THREE.CanvasTexture(canvas)
        tex.flipY = false // glTF UV convention
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy() // stays sharp mid-spin
        gltf.scene.traverse((o) => {
          const m = (o as Mesh).material as MeshStandardMaterial | undefined
          if (m && (m.name === 'Logo' || m.name === 'LogoBack')) {
            // self-lit print: true brand colours regardless of the studio lighting,
            // with a little lit shading kept so the face still reads as 3D
            m.map = tex
            m.emissiveMap = tex
            m.emissive.set(0xffffff)
            m.emissiveIntensity = 0.75
            m.color.setScalar(0.35)
            m.metalness = 0
            m.roughness = 0.45
            m.toneMapped = false
            m.needsUpdate = true
          }
        })
      }

      const camera = gltf.cameras[0] as PerspectiveCamera
      const baseFov = camera.fov
      const baseAspect = camera.aspect
      const resize = () => {
        const w = host.clientWidth || 1
        const h = host.clientHeight || 1
        renderer.setSize(w, h)
        camera.aspect = w / h
        // narrower box than Blender's render: widen the FOV so nothing gets cropped
        camera.fov =
          camera.aspect >= baseAspect
            ? baseFov
            : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * (baseAspect / camera.aspect)))
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(host)

      const mixer = new THREE.AnimationMixer(gltf.scene)
      const duration = Math.max(0, ...gltf.animations.map((c) => c.duration))
      for (const clip of gltf.animations) {
        const action = mixer.clipAction(clip)
        if (!loop) {
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
        }
        action.play()
      }

      host.appendChild(renderer.domElement)
      setReady(true)

      let done = false
      const finish = () => {
        if (done) return
        done = true
        onDoneRef.current?.()
      }

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduceMotion) {
        // one still frame: the end pose for one-shots, the first for loops
        mixer.setTime(loop ? 0 : duration)
        renderer.render(scene, camera)
        if (!loop) finish()
      } else {
        let last = performance.now()
        renderer.setAnimationLoop((now) => {
          // rAF stamps can predate `last`; a negative step ends LoopOnce clips at frame 0
          mixer.update(Math.min(Math.max(now - last, 0) / 1000, 0.1))
          last = now
          renderer.render(scene, camera)
          if (!loop && mixer.time >= duration) finish()
        })
      }

      cleanup = () => {
        renderer.setAnimationLoop(null)
        ro.disconnect()
        mixer.stopAllAction()
        pmrem.dispose()
        renderer.dispose()
        renderer.forceContextLoss() // overlays remount often; don't leak GL contexts
        renderer.domElement.remove()
      }
    })()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [src, loop, logoUrl, logoBg])

  return (
    <div ref={hostRef} className={cn('relative [&>canvas]:absolute [&>canvas]:inset-0', className)}>
      {!ready && fallback}
    </div>
  )
}
