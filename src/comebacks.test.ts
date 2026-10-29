import { describe, expect, it } from 'vitest'
import { comebackFor, comebackOrder, finishedShows, type ShowNews } from './comebacks'
import type { Watch } from './types'

const log = (extra: Partial<Watch>): Watch => ({
  id: 'w', kind: 'tv', householdId: 'h1', showId: 1, showName: 'The Bear', poster: null, network: null, genres: [], year: '2022',
  season: 1, episodesWatched: 8, totalEpisodes: 8, runtime: 30, month: '2026-01', status: 'done', watchedBy: ['l'], ratings: {},
  isRewatch: false, notes: '', createdBy: 'l', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...extra,
})
const season = (number: number, premiereDate: string | null, episodes: number | null = 10) => ({ id: number * 100, number, episodes, aired: false, premiereDate })
const news = (seasons: ReturnType<typeof season>[], status = 'Running', ended: string | null = null): ShowNews => ({ status, ended, seasons })
const TODAY = '2026-10-29'

describe('finishedShows', () => {
  it('keeps series whose latest season is done, one per show, most recent first', () => {
    const list = [
      log({ id: 'a1', showId: 1, season: 1, updatedAt: '2026-01-01' }),
      log({ id: 'a2', showId: 1, season: 2, updatedAt: '2026-03-01' }),
      log({ id: 'b', showId: 2, updatedAt: '2026-05-01' }),
      log({ id: 'c', showId: 3, status: 'watching' }),
      log({ id: 'm', showId: 4, kind: 'movie' }),
    ]
    expect(finishedShows(list).map((w) => w.id)).toEqual(['b', 'a2'])
  })

  it('skips a show with any season still in progress', () => {
    expect(finishedShows([log({ id: 'a', season: 1 }), log({ id: 'b', season: 2, status: 'watching' })])).toEqual([])
  })

  it('keeps households apart', () => {
    expect(finishedShows([log({ id: 'a', householdId: 'h1' }), log({ id: 'b', householdId: 'h2' })])).toHaveLength(2)
  })
})

describe('comebackFor', () => {
  const head = log({ season: 2 })

  it('a recent new season is out, ready to start', () => {
    const c = comebackFor(head, news([season(1, '2024-01-01'), season(2, '2025-01-01'), season(3, '2026-10-10')]), TODAY)
    expect(c).toMatchObject({ type: 'out', season: 3, date: '2026-10-10', key: '1:out:3' })
    expect(c?.info?.number).toBe(3)
  })

  it('an old season you never got to is not news', () => {
    expect(comebackFor(head, news([season(2, '2025-01-01'), season(3, '2026-01-10')]), TODAY)).toBeNull()
  })

  it('a new season after one you skipped: news about the newest, start from the first you missed', () => {
    const c = comebackFor(head, news([season(3, '2025-06-01'), season(4, '2026-10-01')]), TODAY)
    expect(c).toMatchObject({ type: 'out', season: 4 })
    expect(c?.info?.number).toBe(3)
  })

  it('a premiere date to look forward to', () => {
    expect(comebackFor(head, news([season(3, '2027-06-12')]), TODAY)).toMatchObject({ type: 'dated', season: 3, date: '2027-06-12' })
  })

  it('renewed: announced without a date', () => {
    expect(comebackFor(head, news([season(3, null, null)]), TODAY)).toMatchObject({ type: 'renewed', season: 3, date: null })
  })

  it('ended recently after the season you watched', () => {
    expect(comebackFor(head, news([season(2, '2026-05-01')], 'Ended', '2026-07-01'), TODAY)).toMatchObject({ type: 'ended', season: 2 })
  })

  it('an ending long ago, or a show still running with nothing new, is not news', () => {
    expect(comebackFor(head, news([season(2, '2020-01-01')], 'Ended', '2020-03-01'), TODAY)).toBeNull()
    expect(comebackFor(head, news([season(1, '2024-01-01'), season(2, '2025-01-01')]), TODAY)).toBeNull()
  })

  it('the key moves on with the news, so a dismissed renewal still announces the date', () => {
    const renewed = comebackFor(head, news([season(3, null)]), TODAY)!
    const dated = comebackFor(head, news([season(3, '2027-01-05')]), TODAY)!
    expect(renewed.key).not.toBe(dated.key)
  })
})

describe('comebackOrder', () => {
  it('out now first (newest), then soonest dates, then renewals, then endings', () => {
    const h = log({ season: 1 })
    const list = [
      comebackFor({ ...h, showId: 5 }, news([season(2, null)]), TODAY)!,
      comebackFor({ ...h, showId: 6 }, news([season(1, '2026-01-01')], 'Ended', '2026-09-01'), TODAY)!,
      comebackFor({ ...h, showId: 2 }, news([season(2, '2027-03-01')]), TODAY)!,
      comebackFor({ ...h, showId: 3 }, news([season(2, '2026-12-01')]), TODAY)!,
      comebackFor({ ...h, showId: 1 }, news([season(2, '2026-10-01')]), TODAY)!,
      comebackFor({ ...h, showId: 4 }, news([season(2, '2026-10-20')]), TODAY)!,
    ]
    expect(list.sort(comebackOrder).map((c) => c.head.showId)).toEqual([4, 1, 3, 2, 5, 6])
  })
})
