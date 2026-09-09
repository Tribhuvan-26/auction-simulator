import { cn } from '@/lib/cn'

type Variant = 'blue' | 'yellow' | 'pink' | 'plain' | 'dark'

const variantClasses: Record<Variant, string> = {
  blue: 'bg-brand-blue text-brand-white',
  yellow: 'bg-brand-yellow text-brand-charcoal',
  pink: 'bg-brand-pink text-brand-white',
  plain: 'bg-brand-white text-brand-charcoal',
  dark: 'bg-brand-charcoal text-brand-white',
}

// Per-variant hover glow, layered on top of the hard offset shadow so the
// button feels lit/tactile rather than a flat rectangle on lift.
const hoverGlowClasses: Record<Variant, string> = {
  blue: 'hover:shadow-glow-blue',
  yellow: 'hover:shadow-glow-yellow',
  pink: 'hover:shadow-glow-pink',
  plain: 'hover:shadow-brutal-lg',
  dark: 'hover:shadow-brutal-lg',
}

/**
 * The brutalist press: hard 4px shadow shrinks to 1px and the button shifts into
 * it on :active, so a click feels like pressing a physical key.
 */
export function BrutalButton({
  variant = 'plain',
  className,
  children,
  ...props
}: { variant?: Variant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'font-heading font-bold border-[3px] border-brand-charcoal shadow-brutal rounded-xl px-4 py-2',
        'transition-[transform,box-shadow] duration-75 select-none',
        'hover:-translate-y-[1px]',
        'active:translate-x-[3px] active:translate-y-[3px] active:shadow-brutal-pressed',
        'disabled:opacity-45 disabled:shadow-brutal-pressed disabled:translate-x-[3px] disabled:translate-y-[3px]',
        'disabled:hover:translate-y-[3px] disabled:cursor-not-allowed disabled:hover:shadow-brutal-pressed',
        variantClasses[variant],
        hoverGlowClasses[variant],
        className
      )}
    >
      {children}
    </button>
  )
}
