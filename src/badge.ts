// The number on the installed app's icon: everything waiting for you.
// Unread chat + watch party invitations you haven't answered + ratings waiting to be revealed to you.
import { pendingReveals, totalUnread, withShowRatings } from './logic'
import type { Comment, PartyAnswer, Watch, WatchParty } from './types'
import { isOpen } from './watchParty'

export interface BadgeInput {
  /** Who's using the app; null (signed out, no person) means nothing is waiting */
  me: string | null
  household: string | null
  /** Chat is on (its tables exist); off = no unread to count */
  social: boolean
  comments: Comment[]
  lastRead: Record<string, string>
  parties: WatchParty[]
  answers: PartyAnswer[]
  watches: Watch[]
  /** Reveals this phone already showed; null on first run (history is never replayed) */
  seen: Set<string> | null
  now?: number
}

/** Open parties another household invited mine to, that I haven't answered (Join or Can't make it). */
export function openInvitations(parties: WatchParty[], answers: PartyAnswer[], me: string | null, household: string | null, now = Date.now()): number {
  if (!me || !household) return 0
  const answered = new Set(answers.filter((a) => a.personId === me).map((a) => a.partyId))
  return parties.filter((p) => p.hostHouseholdId !== household && p.guests.includes(household) && isOpen(p, now) && !answered.has(p.id)).length
}

export function badgeCount(i: BadgeInput): number {
  if (!i.me) return 0
  const chat = i.social ? totalUnread(i.comments, i.lastRead, i.me) : 0
  const invites = openInvitations(i.parties, i.answers, i.me, i.household, i.now)
  const reveals = i.seen ? pendingReveals(withShowRatings(i.watches), i.me, i.seen).length : 0
  return Math.max(0, chat + invites + reveals)
}

/** Largest number kept (a runaway counter never grows forever) */
export const BADGE_MAX = 999

/**
 * The service worker's counter (sw.js has a plain-JS copy): a push arrived while the app was closed,
 * so add one to what the app last stored. Anything unreadable counts as 0.
 */
export function bumpBadge(stored: string | null | undefined): number {
  const n = Number.parseInt(stored ?? '', 10)
  return Math.min(BADGE_MAX, (Number.isFinite(n) && n > 0 ? n : 0) + 1)
}
