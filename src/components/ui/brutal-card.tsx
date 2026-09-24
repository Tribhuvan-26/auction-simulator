import { cn } from '@/lib/cn'

type BrutalCardVariant = 'default' | 'active' | 'sold' | 'unsold' | 'pressed'

// Architectural brutalist panels: crisp technical borders, dark surfaces, hard offsets
const variantClasses: Record<BrutalCardVariant, string> = {
  default: 'border-brand-charcoal shadow-brutal bg-[#181818] text-brand-white',
  active: 'border-brand-blue shadow-glow-blue bg-[#1C1C1C] layer-plate layer-plate-blue text-brand-white',
  sold: 'border-brand-yellow shadow-glow-yellow bg-[#1C1C1C] layer-plate layer-plate-yellow text-brand-white',
  unsold: 'border-brand-charcoal shadow-brutal bg-brand-white/60 text-brand-charcoal',
  pressed: 'border-brand-charcoal shadow-brutal-pressed bg-[#181818] text-brand-white translate-x-[2px] translate-y-[2px]',
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
    <div className={cn('border-[2px] rounded-none p-4', variantClasses[variant], className)}>
      {children}
    </div>
  )
}

/** Dark architectural section header bar — "CURRENT STATUS", "BIDDING LOG", etc. */
export function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-[#242424] border-b border-white/10 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-widest text-brand-white', className)}>
      {children}
    </div>
  )
}

