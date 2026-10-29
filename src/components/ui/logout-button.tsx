'use client'

export function LogoutButton({ action, className }: { action: () => Promise<void>; className?: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await action()
        window.location.reload()
      }}
      className={className}
    >
      LOG OUT
    </button>
  )
}
