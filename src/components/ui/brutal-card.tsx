import { cn } from '@/lib/cn'

type BrutalCardVariant = 'default' | 'active' | 'sold' | 'unsold' | 'pressed'

const variantClasses: Record<BrutalCardVariant, string> = {
  default: 'border-brand-charcoal shadow-brutal bg-brand-white',
  active: 'border-brand-blue shadow-brutal bg-brand-white',
  sold: 'border-brand-yellow shadow-brutal bg-brand-white',
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
    <div className={cn('border-2 rounded-none p-4', variantClasses[variant], className)}>
      {children}
    </div>
  )
}
