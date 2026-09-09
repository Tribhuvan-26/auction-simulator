import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-blue': 'var(--color-blue)',
        'brand-yellow': 'var(--color-yellow)',
        'brand-pink': 'var(--color-pink)',
        'brand-white': 'var(--color-white)',
        'brand-charcoal': 'var(--color-charcoal)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
      },
      boxShadow: {
        brutal: '4px 4px 0 #282828',
        'brutal-pressed': '1px 1px 0 #282828',
      },
    },
  },
} satisfies Config
