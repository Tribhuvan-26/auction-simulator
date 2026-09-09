// All money fields in the schema (basePrice, currentBid, purseTotal, purseRemaining)
// are stored as whole lakhs (1 = ₹1,00,000) — this is the one place that turns that
// into what IPL auctions actually say out loud: lakhs under a crore, crore above it.
export function formatMoney(lakhs: number): string {
  if (lakhs >= 100) {
    const crore = Math.round((lakhs / 100) * 100) / 100
    return `${crore} Cr`
  }
  return `${lakhs} L`
}
