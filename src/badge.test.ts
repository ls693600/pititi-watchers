import { describe, expect, it } from 'vitest'
import { BADGE_MAX, badgeCount, bumpBadge, openInvitations, type BadgeInput } from './badge'
import { BADGE_CACHE, BADGE_ENTRY } from './hooks/useAppBadge'
import { revealKey, threadKey } from './logic'
import type { Comment, PartyAnswer, Watch, WatchParty } from './types'
import src from '../public/sw.js?raw'

const NOW = Date.parse('2026-10-20T19:00:00Z')
const iso = (minFromNow: number) => new Date(NOW + minFromNow * 60_000).toISOString()

const msg = (id: string, personId: string, min: number, watchId: string | null = null): Comment => ({ id, watchId, personId, text: 'hi', createdAt: iso(-min) })
const party = (extra: Partial<WatchParty> = {}): WatchParty => ({
  id: 'p1', hostHouseholdId: 'h2', createdBy: 'fer', kind: 'tv', extId: 1, title: 'Severance', poster: null, season: 2, episode: 7, runtime: 52,
  startsAt: iso(120), state: 'planned', playAt: null, positionSec: 0, pausedBy: null, updatedAt: '', createdAt: '', guests: ['h1'], ...extra,
})
const watch = (over: Partial<Watch> = {}): Watch => ({
  id: 'w1', showId: 1, showName: 'Severance', poster: null, network: null, genres: [], year: '2022', season: 1, episodesWatched: 9, totalEpisodes: 9,
  runtime: 50, month: '2026-10', status: 'done', watchedBy: ['L', 'A'], ratings: { L: 8, A: 9 }, isRewatch: false, notes: '', createdBy: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
})

const base: BadgeInput = { me: 'L', household: 'h1', social: true, comments: [], lastRead: {}, parties: [], answers: [], watches: [], seen: new Set(), now: NOW }
const count = (extra: Partial<BadgeInput>) => badgeCount({ ...base, ...extra })

describe('app icon badge', () => {
  it('is 0 when nothing is waiting', () => {
    expect(count({})).toBe(0)
  })

  it('counts unread chat from others, in the Family chat and show chats, never my own', () => {
    const comments = [msg('c1', 'A', 30), msg('c2', 'fer', 5, 'w-103'), msg('c3', 'L', 1)]
    expect(count({ comments })).toBe(2)
  })

  it('reading the chat clears it', () => {
    const comments = [msg('c1', 'A', 30), msg('c2', 'A', 10)]
    expect(count({ comments, lastRead: { [threadKey(null)]: iso(-20) } })).toBe(1)
    expect(count({ comments, lastRead: { [threadKey(null)]: iso(0) } })).toBe(0)
  })

  it('chat off (no tables yet) counts no messages', () => {
    expect(count({ social: false, comments: [msg('c1', 'A', 30)] })).toBe(0)
  })

  it('counts an open invitation to my household that I have not answered', () => {
    expect(count({ parties: [party()] })).toBe(1)
    expect(count({ parties: [party({ state: 'playing', playAt: iso(-5) })] })).toBe(1)
  })

  it('answering clears it (Join or Can not make it); someone else answering does not', () => {
    const answered = (answer: PartyAnswer['answer'], personId = 'L') => count({ parties: [party()], answers: [{ partyId: 'p1', personId, answer }] })
    expect(answered('join')).toBe(0)
    expect(answered('no')).toBe(0)
    expect(answered('join', 'A')).toBe(1)
    expect(count({ parties: [party()], answers: [{ partyId: 'other', personId: 'L', answer: 'join' }] })).toBe(1)
  })

  it('ended, cancelled and expired parties are not counted', () => {
    expect(count({ parties: [party({ state: 'ended' })] })).toBe(0)
    expect(count({ parties: [party({ state: 'cancelled' })] })).toBe(0)
    expect(count({ parties: [party({ startsAt: iso(-4 * 60) })] })).toBe(0)
  })

  it("my own household's party and another household's party are not counted", () => {
    expect(count({ parties: [party({ hostHouseholdId: 'h1', guests: ['h2'] })] })).toBe(0)
    expect(count({ parties: [party({ hostHouseholdId: 'h3', guests: ['h4'] })] })).toBe(0)
    expect(openInvitations([party()], [], 'L', null, NOW)).toBe(0)
  })

  it('counts ratings waiting to be revealed to me, and none once seen or on the first run', () => {
    const w = watch()
    expect(count({ watches: [w] })).toBe(1)
    expect(count({ watches: [w], seen: new Set([revealKey(w)]) })).toBe(0)
    expect(count({ watches: [w], seen: null })).toBe(0)
    // Not mine to reveal: I didn't watch it
    expect(count({ watches: [watch({ watchedBy: ['A', 'M'], ratings: { A: 7, M: 6 } })] })).toBe(0)
  })

  it('adds the three sources together', () => {
    expect(count({ comments: [msg('c1', 'A', 30), msg('c2', 'fer', 3)], parties: [party(), party({ id: 'p2' })], watches: [watch()] })).toBe(5)
  })

  it('no person (signed out) is always 0', () => {
    expect(count({ me: null, comments: [msg('c1', 'A', 30)], parties: [party()], watches: [watch()] })).toBe(0)
  })

  it('a viewer (no household) never counts invitations', () => {
    expect(count({ me: 'guest', household: null, parties: [party()] })).toBe(0)
  })

  it('is never negative', () => {
    expect(count({ comments: [], parties: [], watches: [] })).toBeGreaterThanOrEqual(0)
  })
})

describe('service worker counter', () => {
  it('adds one to what the app stored; anything unreadable starts from 0', () => {
    expect(bumpBadge('3')).toBe(4)
    expect(bumpBadge('0')).toBe(1)
    expect(bumpBadge(null)).toBe(1)
    expect(bumpBadge(undefined)).toBe(1)
    expect(bumpBadge('')).toBe(1)
    expect(bumpBadge('abc')).toBe(1)
    expect(bumpBadge('-5')).toBe(1)
    expect(bumpBadge(String(BADGE_MAX))).toBe(BADGE_MAX)
  })

  it('sw.js has the same counter (it cannot import TypeScript)', () => {
    const body = src.match(/function bumpBadge\(stored\) \{[\s\S]*?\n\}/)?.[0]
    expect(body).toBeTruthy()
    const swBump = new Function(`${body}; return bumpBadge`)() as (s: string | null) => number
    for (const s of ['3', '0', null, '', 'abc', '-5', String(BADGE_MAX), '12']) expect(swBump(s)).toBe(bumpBadge(s))
    // The app and the worker share one cache entry, and a new worker version keeps it
    expect(src).toContain(`const BADGE_CACHE = '${BADGE_CACHE}'`)
    expect(src).toContain(`const BADGE_ENTRY = '${BADGE_ENTRY}'`)
    expect(src).toContain('k !== CACHE && k !== BADGE_CACHE')
  })
})
