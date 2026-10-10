import localFont from 'next/font/local'

// Self-hosted copies of the Google Fonts files: next/font/google fetches them at
// build time, and a bad response from Google fails the whole deploy. Same split
// Google serves — a preloaded latin file plus latin-ext (where ₹ lives), each
// claiming its unicode-range under one family name.
// next/font only accepts literal options, hence the repeated ranges.

export const spaceGrotesk = localFont({
  // fixed 500 + 700 faces, like Google serves it: 600 snaps to 700 rather than interpolating
  src: [{ path: './fonts/space-grotesk-latin.woff2', weight: '500' }, { path: './fonts/space-grotesk-latin.woff2', weight: '700' }],
  variable: '--font-heading',
  declarations: [{ prop: 'font-family', value: 'Space Grotesk' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})
export const spaceGroteskExt = localFont({
  // fixed 500 + 700 faces, like Google serves it: 600 snaps to 700 rather than interpolating
  src: [{ path: './fonts/space-grotesk-latin-ext.woff2', weight: '500' }, { path: './fonts/space-grotesk-latin-ext.woff2', weight: '700' }],
  preload: false,
  variable: '--font-heading-ext', // unused var; referencing it is what keeps this @font-face in the CSS
  declarations: [{ prop: 'font-family', value: 'Space Grotesk' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})

export const inter = localFont({
  src: './fonts/inter-latin.woff2',
  weight: '400 600',
  variable: '--font-body',
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})
export const interExt = localFont({
  src: './fonts/inter-latin-ext.woff2',
  weight: '400 600',
  preload: false,
  variable: '--font-body-ext', // unused var; referencing it is what keeps this @font-face in the CSS
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})

export const oswald = localFont({
  src: './fonts/oswald-latin.woff2',
  weight: '500 700',
  variable: '--font-condensed',
  declarations: [{ prop: 'font-family', value: 'Oswald' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})
export const oswaldExt = localFont({
  src: './fonts/oswald-latin-ext.woff2',
  weight: '500 700',
  preload: false,
  variable: '--font-condensed-ext', // unused var; referencing it is what keeps this @font-face in the CSS
  declarations: [{ prop: 'font-family', value: 'Oswald' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})

export const bebasNeue = localFont({
  src: './fonts/bebas-neue-latin.woff2',
  weight: '400',
  variable: '--font-bebas',
  declarations: [{ prop: 'font-family', value: 'Bebas Neue' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})
export const bebasNeueExt = localFont({
  src: './fonts/bebas-neue-latin-ext.woff2',
  weight: '400',
  preload: false,
  variable: '--font-bebas-ext', // unused var; referencing it is what keeps this @font-face in the CSS
  declarations: [{ prop: 'font-family', value: 'Bebas Neue' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})

export const teko = localFont({
  src: './fonts/teko-latin.woff2',
  weight: '500 700',
  variable: '--font-teko',
  declarations: [{ prop: 'font-family', value: 'Teko' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})
export const tekoExt = localFont({
  src: './fonts/teko-latin-ext.woff2',
  weight: '500 700',
  preload: false,
  variable: '--font-teko-ext', // unused var; referencing it is what keeps this @font-face in the CSS
  declarations: [{ prop: 'font-family', value: 'Teko' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
})
