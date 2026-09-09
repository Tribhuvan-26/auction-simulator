import { cn } from '@/lib/cn'

/**
 * Real photo when photoUrl set. Else gradient-fill circular block with
 * initials as fallback — used anywhere a player is featured prominently.
 */
export function PlayerAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl?: string | null
  className?: string
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external/local player photos, no next/image domain config for these
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        className={cn(
          'shrink-0 rounded-full border-[3px] border-brand-charcoal object-cover shadow-brutal',
          className
        )}
      />
    )
  }

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-[3px] border-brand-charcoal font-heading font-bold text-brand-white shadow-brutal',
        className
      )}
      style={{ background: 'linear-gradient(135deg, var(--color-blue), var(--color-pink))' }}
      aria-hidden
    >
      {initials}
    </div>
  )
}
