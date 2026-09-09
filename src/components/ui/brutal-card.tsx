import { cn } from '@/lib/cn'

type BrutalCardVariant = 'default' | 'active' | 'sold' | 'unsold' | 'pressed'

// active/sold get a layered plate + ambient glow so importance reads at a
// glance, without having to parse the text inside.
const variantClasses: Record<BrutalCardVariant, string> = {
  default: 'border-brand-charcoal shadow-brutal bg-brand-white',
  active: 'border-brand-blue shadow-glow-blue bg-brand-white layer-plate layer-plate-blue',
  sold: 'border-brand-yellow shadow-glow-yellow bg-brand-white layer-plate layer-plate-yellow',
  unsold: 'border-brand-charcoal shadow-brutal bg-brand-white/60',
  pressed: 'border-brand-charcoal shadow-brutal-pressed bg-brand-white translate-x-[3px] translate-y-[3px]',
}

export function BrutalCard({
  variant = 'default',
  className,
  children,
}: {
  variant?: BrutalCardVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('border-2 rounded-2xl p-4', variantClasses[variant], className)}>
      {children}
    </div>
  )
}
