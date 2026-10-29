'use client'

/**
 * An inline <script> that runs during HTML parsing, before first paint. React
 * warns in development whenever the client renders a <script> (it never
 * executes them), so the client copy is typed as inert text/plain — the
 * server-rendered one has already run. suppressHydrationWarning covers the
 * type mismatch. Pattern from Next's "Preventing flash before hydration" guide.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
