// Load per-player career stats from the combined stats sheet into every room's
// players. The sheet is a CSV despite its .xls name, and it is sparse by role:
// batters fill the batting columns, bowlers the bowling ones, keepers the
// dismissal ones, and the match count lands in whichever of the three match
// columns that player's source filled in.
//
//   npm run import-stats -- "C:/Users/aishw/Downloads/ipl_2026_combined_players_stats_correct.xls"
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export type PlayerStats = {
  name: string
  matches: number
  runs: number | null
  wickets: number | null
  average: number | null
  strikeRate: number | null
  economy: number | null
  isOverseas: boolean
  setNumber: string
}

/** The sheet writes a missing value as an empty cell or a bare dash. */
function num(cell: string | undefined): number | null {
  const value = (cell ?? '').trim()
  if (value === '' || value === '-') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseStatsCsv(text: string): PlayerStats[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const header = lines[0].split(',')
  const at = (name: string) => {
    const index = header.indexOf(name)
    if (index === -1) throw new Error(`Stats sheet has no "${name}" column`)
    return index
  }
  const [matchesCol, t20MatchesCol, altMatchesCol] = [at('Matches'), at('T20 Matches'), at('Matches.1')]
  const cols = {
    name: at('Player'),
    runs: at('Runs'),
    wickets: at('Wickets'),
    average: at('Batting Average'),
    strikeRate: at('Batting Strike Rate'),
    economy: at('Economy'),
    overseas: at('Overseas'),
    capped: at('Capped Status'),
  }

  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(',')
    // Sources disagree on which match column they fill, and a player who has
    // played more matches never has a lower count in another column — so the
    // largest of the three is the real career total.
    const matches = Math.max(
      ...[matchesCol, t20MatchesCol, altMatchesCol].map((c) => num(cells[c]) ?? 0),
    )
    // Overseas is its own bucket, not a capped/uncapped value: the sheet leaves
    // Capped Status blank for these players.
    const isOverseas = (cells[cols.overseas] ?? '').trim() !== ''
    const capped = (cells[cols.capped] ?? '').trim()
    return {
      name: cells[cols.name].trim(),
      matches,
      runs: num(cells[cols.runs]),
      wickets: num(cells[cols.wickets]),
      average: num(cells[cols.average]),
      strikeRate: num(cells[cols.strikeRate]),
      economy: num(cells[cols.economy]),
      isOverseas,
      setNumber: isOverseas ? 'Overseas Players' : capped === 'Capped' ? 'Capped Players' : 'Uncapped Players',
    }
  })
}

async function main() {
  const path = process.argv[2]
  if (!path) throw new Error('Pass the path to the stats sheet')
  const stats = parseStatsCsv(readFileSync(path, 'utf-8'))

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  let updated = 0
  const unmatched: string[] = []
  for (const player of stats) {
    const { name, ...data } = player
    const { count } = await prisma.player.updateMany({ where: { name }, data })
    if (count === 0) unmatched.push(name)
    updated += count
  }

  console.log(`Updated ${updated} player rows from ${stats.length} sheet rows.`)
  if (unmatched.length) console.log(`No player row matched: ${unmatched.join(', ')}`)
  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
