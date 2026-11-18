// Watch parties: the same episode or movie, at the same time, on different couches. The app can't control the TVs,
// so "together" means a shared 3-2-1 to press play, a shared pause, and a chat that lives with the party.
import { locale, t } from './i18n'
import { localDay } from './lib/dates'
import type { PartyAnswer, WatchParty } from './types'

/** Seconds between "start" and pressing play: time for everyone's phone to show the 3-2-1 */
export const COUNTDOWN_SEC = 4
/** A party that never starts closes this long after its planned time (the server does the same) */
export const PARTY_EXPIRES_HOURS = 3

export type PartyAction = 'start' | 'pause' | 'resume' | 'end' | 'cancel'

/** Is my household in this party (host or invited)? */
export function inParty(p: WatchParty, household: string | null): boolean {
  return household != null && (p.hostHouseholdId === household || p.guests.includes(household))
}

export function isOpen(p: WatchParty, now = Date.now()): boolean {
  if (p.state === 'ended' || p.state === 'cancelled') return false
  if (p.state === 'planned') return Date.parse(p.startsAt) > now - PARTY_EXPIRES_HOURS * 3_600_000
  return true
}

/** The party to show on Home: playing first, then the next planned one (within a day). */
export function partyForHome(parties: WatchParty[], household: string | null, now = Date.now()): WatchParty | null {
  const mine = parties.filter((p) => inParty(p, household) && isOpen(p, now))
  const live = mine.find((p) => p.state !== 'planned')
  if (live) return live
  return mine.filter((p) => Date.parse(p.startsAt) < now + 24 * 3_600_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
}

export type PartyPhase =
  | { phase: 'planned'; startsIn: number }
  | { phase: 'countdown'; left: number }
  | { phase: 'playing'; at: number }
  | { phase: 'paused'; at: number }
  | { phase: 'over' }

/** Where the party is at `now` (server-corrected ms): seconds to the 3-2-1, or seconds into the episode. */
export function partyPhase(p: WatchParty, now: number): PartyPhase {
  if (p.state === 'ended' || p.state === 'cancelled') return { phase: 'over' }
  if (p.state === 'paused') return { phase: 'paused', at: p.positionSec }
  if (p.state === 'planned') return { phase: 'planned', startsIn: Math.max(0, Math.round((Date.parse(p.startsAt) - now) / 1000)) }
  const playAt = p.playAt ? Date.parse(p.playAt) : now
  if (now < playAt) return { phase: 'countdown', left: Math.ceil((playAt - now) / 1000) }
  return { phase: 'playing', at: p.positionSec + Math.floor((now - playAt) / 1000) }
}

/** 18:32 / 1:02:05 */
export function clockLabel(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Who said Join / Can't make it */
export function answersFor(p: WatchParty, answers: PartyAnswer[]) {
  const mine = answers.filter((a) => a.partyId === p.id)
  return { joined: mine.filter((a) => a.answer === 'join').map((a) => a.personId), no: mine.filter((a) => a.answer === 'no').map((a) => a.personId) }
}

/** Same rules as the server's party_control: who may do what, and the party afterwards. Throws the server's error codes. */
export function applyControl(p: WatchParty, action: PartyAction, opts: { now: number; me: string; myHousehold: string | null; joined: boolean; atSec?: number | null }): WatchParty {
  const host = p.hostHouseholdId === opts.myHousehold
  const iso = (ms: number) => new Date(ms).toISOString()
  if (!inParty(p, opts.myHousehold)) throw new Error('not_your_party')
  if (p.state === 'ended' || p.state === 'cancelled') throw new Error('party_over')
  const at = { ...p, updatedAt: iso(opts.now) }
  switch (action) {
    case 'start':
      if (p.state !== 'planned') throw new Error('already_started')
      if (!host && !opts.joined) throw new Error('join_first')
      return { ...at, state: 'playing', playAt: iso(opts.now + COUNTDOWN_SEC * 1000), positionSec: 0, pausedBy: null }
    case 'pause': {
      if (p.state !== 'playing') throw new Error('not_playing')
      if (!opts.joined) throw new Error('join_first')
      const here = partyPhase(p, opts.now)
      const pos = opts.atSec ?? (here.phase === 'playing' ? here.at : p.positionSec)
      return { ...at, state: 'paused', positionSec: pos, pausedBy: opts.me, playAt: null }
    }
    case 'resume':
      if (p.state !== 'paused') throw new Error('not_paused')
      if (!opts.joined) throw new Error('join_first')
      return { ...at, state: 'playing', playAt: iso(opts.now + COUNTDOWN_SEC * 1000) }
    case 'end':
    case 'cancel':
      if (!host) throw new Error('host_only')
      return { ...at, state: action === 'cancel' || p.state === 'planned' ? 'cancelled' : 'ended', playAt: null }
  }
}

/** "S2 E7" or the movie's name alone */
export function partyEpisode(p: Pick<WatchParty, 'kind' | 'season' | 'episode'>): string | null {
  return p.kind === 'tv' && p.season != null && p.episode != null ? `S${p.season} E${p.episode}` : null
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })

/** "tonight 21:00" / "tomorrow 20:30" / "Sat 21:00" */
export function whenLabel(iso: string, now = Date.now()): string {
  const day = localDay(new Date(iso))
  if (day === localDay(now)) return t('today {time}', { time: timeLabel(iso) })
  if (day === localDay(now, 1)) return t('tomorrow {time}', { time: timeLabel(iso) })
  return `${new Date(iso).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })} ${timeLabel(iso)}`
}
