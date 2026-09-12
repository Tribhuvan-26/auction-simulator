import { Space_Grotesk, Inter, Cormorant_Garamond } from 'next/font/google'

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '500', '700'],
  variable: '--font-heading',
})

export const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
})

// Landing page hero title only — an elegant high-contrast serif for a
// premium/luxury feel, distinct from the app's own brutalist heading font.
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '500', '600'],
  variable: '--font-luxury',
})
