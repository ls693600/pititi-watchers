import { describe, expect, it } from 'vitest'
import type { WatchParty } from './types'
import { applyControl, clockLabel, inParty, isOpen, partyForHome, partyPhase } from './watchParty'

const T0 = Date.parse('2026-11-20T21:00:00Z')
const party = (extra: Partial<WatchParty> = {}): WatchParty => ({
  id: 'p1', hostHouseholdId: 'h1', createdBy: 'leo', kind: 'tv', extId: 1, title: 'Severance', poster: null, season: 2, episode: 7, runtime: 52,
  startsAt: new Date(T0).toISOString(), state: 'planned', playAt: null, positionSec: 0, pausedBy: null, updatedAt: '', createdAt: '', guests: ['h2'], ...extra,
})
const as = (me: string, myHousehold: string | null, joined = true) => ({ now: T0, me, myHousehold, joined })

describe('watch party rules (same as the server)', () => {
  it('only the host and invited households are in it', () => {
    expect(inParty(party(), 'h1')).toBe(true)
    expect(inParty(party(), 'h2')).toBe(true)
    expect(inParty(party(), 'h3')).toBe(false)
    expect(inParty(party(), null)).toBe(false)
    expect(() => applyControl(party(), 'start', as('x', 'h3'))).toThrow('not_your_party')
  })

  it('start gives everyone the same 3-2-1, then counts the time in', () => {
    const p = applyControl(party(), 'start', as('leo', 'h1'))
    expect(p.state).toBe('playing')
    expect(partyPhase(p, T0 + 1000)).toEqual({ phase: 'countdown', left: 3 })
    expect(partyPhase(p, T0 + 4000)).toEqual({ phase: 'playing', at: 0 })
    expect(partyPhase(p, T0 + 4000 + 1112_000)).toEqual({ phase: 'playing', at: 1112 })
  })

  it('a guest must say Join before starting or pausing', () => {
    expect(() => applyControl(party(), 'start', as('fer', 'h2', false))).toThrow('join_first')
    const playing = applyControl(party(), 'start', as('fer', 'h2'))
    expect(() => applyControl(playing, 'pause', as('lara', 'h2', false))).toThrow('join_first')
  })

  it('pause keeps where everyone is and who paused; resume counts down again from there', () => {
    const playing = applyControl(party(), 'start', as('leo', 'h1'))
    const paused = applyControl(playing, 'pause', { ...as('fer', 'h2'), now: T0 + 4000 + 60_000 })
    expect(paused).toMatchObject({ state: 'paused', positionSec: 60, pausedBy: 'fer', playAt: null })
    expect(partyPhase(paused, T0 + 999_999)).toEqual({ phase: 'paused', at: 60 })
    const resumed = applyControl(paused, 'resume', { ...as('leo', 'h1'), now: T0 + 100_000 })
    expect(partyPhase(resumed, T0 + 104_000 + 10_000)).toEqual({ phase: 'playing', at: 70 })
    expect(() => applyControl(resumed, 'resume', as('leo', 'h1'))).toThrow('not_paused')
  })

  it('only the host household ends it; ending a party that never started cancels it', () => {
    const playing = applyControl(party(), 'start', as('leo', 'h1'))
    expect(() => applyControl(playing, 'end', as('fer', 'h2'))).toThrow('host_only')
    expect(applyControl(playing, 'end', as('ana', 'h1')).state).toBe('ended')
    expect(applyControl(party(), 'end', as('leo', 'h1')).state).toBe('cancelled')
    expect(() => applyControl(applyControl(playing, 'end', as('leo', 'h1')), 'pause', as('leo', 'h1'))).toThrow('party_over')
  })

  it('Home shows the party that is on, else the next one within a day; old ones close', () => {
    const later = party({ id: 'later', startsAt: new Date(T0 + 3 * 86_400_000).toISOString() })
    const soon = party({ id: 'soon', startsAt: new Date(T0 + 3_600_000).toISOString() })
    const live = party({ id: 'live', state: 'paused' })
    expect(partyForHome([later, soon], 'h2', T0)?.id).toBe('soon')
    expect(partyForHome([later, soon, live], 'h2', T0)?.id).toBe('live')
    expect(partyForHome([soon], 'h3', T0)).toBeNull()
    expect(isOpen(party(), T0 + 4 * 3_600_000)).toBe(false)
    expect(isOpen(party({ state: 'ended' }), T0)).toBe(false)
  })

  it('reads the time like a player', () => {
    expect(clockLabel(1112)).toBe('18:32')
    expect(clockLabel(3725)).toBe('1:02:05')
    expect(clockLabel(-3)).toBe('0:00')
  })
})
