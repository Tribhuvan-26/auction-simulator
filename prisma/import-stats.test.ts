import { describe, it, expect } from 'vitest'
import { parseStatsCsv } from './import-stats'

const HEADER =
  'Player,Role,Team,Format,Matches,Runs,Highest Score,Batting Average,Batting Strike Rate,50s,100s,Bowling Innings,Wickets,Best Bowling,Economy,Bowling Average,Bowling Strike Rate,Catches,Stumpings,Total Dismissals,Capped Status,Overseas,Source #,Source,T20 Matches,Notes,Matches.1'

describe('parseStatsCsv', () => {
  it('reads a batter row', () => {
    const [row] = parseStatsCsv(
      `${HEADER}\nShreyas Iyer,Batter,Punjab Kings,T20,246,6786,147,34.44,137.67,46,3,,,,,,,,,,Capped,,4,url,,,`,
    )
    expect(row).toMatchObject({
      name: 'Shreyas Iyer',
      matches: 246,
      runs: 6786,
      average: 34.44,
      strikeRate: 137.67,
      wickets: null,
      economy: null,
      isOverseas: false,
      setNumber: 'Capped Players',
    })
  })

  it('takes the largest of the three match columns', () => {
    const [row] = parseStatsCsv(
      `${HEADER}\nArshdeep Singh,Bowler,Punjab Kings,,,,,,,,,202,267,May-32,8.67,23.31,16.1,,,,Capped,,1,url,204,,`,
    )
    expect(row.matches).toBe(204)
    expect(row.wickets).toBe(267)
    expect(row.economy).toBe(8.67)
    expect(row.runs).toBeNull()
  })

  it('buckets an overseas player as overseas, not capped or uncapped', () => {
    const [row] = parseStatsCsv(
      `${HEADER}\nXavier Bartlett,Bowler,Punjab Kings,,,,,,,,,109,133,04-Oct,8.83,24.7,16.7,,,,,Overseas,2,url,111,,`,
    )
    expect(row.isOverseas).toBe(true)
    expect(row.setNumber).toBe('Overseas Players')
  })

  it('turns a dash or an empty cell into null, never zero', () => {
    const [row] = parseStatsCsv(
      `${HEADER}\nVishal Nishad,Batter,Punjab Kings,T20,9,0,0,-,-,0,0,,,,,,,,,,Uncapped,,5,url,,,`,
    )
    expect(row.average).toBeNull()
    expect(row.strikeRate).toBeNull()
    expect(row.runs).toBe(0)
    expect(row.setNumber).toBe('Uncapped Players')
  })
})
