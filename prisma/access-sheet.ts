// Build the printable room access sheet from whatever database DATABASE_URL
// names: admin PIN, display board, and one row per team seat. Writes HTML —
// open it and print to PDF (Ctrl+P) to refresh Auction-Deployed-Links.pdf.
//
//   npm run access-sheet
import { writeFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const BASE_URL = process.env.DEPLOY_URL ?? 'https://auction.mlritcie.in'
const OUT = join(__dirname, '..', 'Auction-Room-Access.html')

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  const rooms = await prisma.auctionRoom.findMany({
    orderBy: { name: 'asc' },
    include: { teams: { orderBy: { shortCode: 'asc' } } },
  })

  const sections = rooms
    .map((room) => {
      const rows = room.teams
        .map(
          (team) => `<tr>
        <td>${escapeHtml(team.name)} (${escapeHtml(team.shortCode)})</td>
        <td class="pin">${escapeHtml(team.passcode)}</td>
        <td><a href="${BASE_URL}/team/${room.code}/${team.shortCode}">Open team console</a></td>
      </tr>`,
        )
        .join('\n')

      return `<section>
    <h1>${escapeHtml(room.name)} (${escapeHtml(room.code)})</h1>
    <h2>Admin</h2>
    <p>URL: <a href="${BASE_URL}/admin/${room.code}">Open admin console</a></p>
    <p>PIN: <strong>${escapeHtml(room.adminPasscode)}</strong></p>
    <h2>Display board</h2>
    <p>URL: <a href="${BASE_URL}/display/${room.code}">Open display board</a></p>
    <h2>Teams</h2>
    <table>
      <thead><tr><th>Team</th><th>PIN</th><th>Team console</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>`
    })
    .join('\n')

  writeFileSync(
    OUT,
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Auction Simulator — Deployed Room Access Sheet</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 40px; font-size: 13px; }
  h1 { font-size: 26px; margin: 36px 0 8px; }
  h2 { font-size: 17px; margin: 18px 0 4px; }
  section { page-break-after: always; }
  section:last-of-type { page-break-after: auto; }
  table { border-collapse: collapse; margin: 8px auto; min-width: 680px; }
  th, td { border: 1px solid #9aa4bf; padding: 6px 10px; text-align: left; }
  th { background: #dbe3f5; }
  .pin { font-variant-numeric: tabular-nums; }
  .title { text-align: center; font-size: 22px; font-weight: bold; }
  a { color: #1155cc; }
</style>
</head>
<body>
<p class="title">Auction Simulator — Deployed Room Access Sheet</p>
<p>Deployed at: <a href="${BASE_URL}">${BASE_URL}</a></p>
<p>Generated ${new Date().toISOString().slice(0, 10)} — PINs live in the database, so regenerate this sheet after any reseed.</p>
${sections}
</body>
</html>
`,
    'utf-8',
  )

  console.log(`Wrote ${OUT} — ${rooms.length} rooms. Open it and print to PDF.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
