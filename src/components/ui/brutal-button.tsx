import { cn } from '@/lib/cn'

type Variant = 'blue' | 'yellow' | 'pink' | 'plain' | 'dark'

const variantClasses: Record<Variant, string> = {
  blue: 'bg-brand-blue text-brand-white border-brand-blue hover:brightness-110',
  yellow: 'bg-brand-yellow text-[#141414] border-brand-yellow hover:brightness-105',
  pink: 'bg-brand-pink text-brand-white border-brand-pink hover:brightness-110',
  plain: 'bg-[#222222] text-brand-white border-white/20 hover:border-white/40 hover:bg-[#2A2A2A]',
  dark: 'bg-[#181818] text-brand-white border-white/15 hover:border-white/35 hover:bg-[#202020]',
}

const hoverGlowClasses: Record<Variant, string> = {
  blue: 'hover:shadow-glow-blue',
  yellow: 'hover:shadow-glow-yellow',
  pink: 'hover:shadow-glow-pink',
  plain: 'hover:shadow-brutal-lg',
  dark: 'hover:shadow-brutal-lg',
}

/**
 * Architectural brutalist button: sharp 0px radius, crisp technical border,
 * tactile tactile physical press, uppercase tracked typography.
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
        'font-heading font-bold uppercase tracking-wider rounded-none px-4 py-2 border-[2px]',
        'shadow-brutal transition-[transform,box-shadow,background-color,border-color] duration-100 select-none cursor-pointer',
        'hover:-translate-y-[1px]',
        'active:translate-x-[2px] active:translate-y-[2px] active:shadow-brutal-pressed',
        'disabled:opacity-40 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0',
        'disabled:hover:translate-y-0 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:brightness-100',
        variantClasses[variant],
        hoverGlowClasses[variant],
        className
      )}
    >
      {children}
    </button>
  )
}

