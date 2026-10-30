// All money fields in the schema (basePrice, currentBid, purseTotal, purseRemaining)
// are stored as whole lakhs (1 = ₹1,00,000). Screens only ever show and take
// crore, so these two are the only places that convert.
export function formatMoney(lakhs: number): string {
  return `${Math.round(lakhs) / 100} Cr`
}

/** A typed crore amount ("2.5") as whole lakhs (250), or NaN if it isn't a number. */
export function croreToLakhs(crore: string): number {
  const n = Number(crore.trim())
  return crore.trim() && Number.isFinite(n) ? Math.round(n * 100) : NaN
}
