import { newId } from '../logic'
import type { Comment, Household, ListItem, Person, Reaction, Recommendation, Watch, WatchList } from '../types'
import type { Snapshot, Store } from './store'

const WATCHES = 'pititi.watches.v2'
const PEOPLE = 'pititi.people.v2'
const UP_NEXT = 'pititi.upnext.v1'
const REACTIONS = 'pititi.reactions.v1'
const COMMENTS = 'pititi.comments.v1'
const HOUSEHOLDS = 'pititi.households.v1'
const LISTS = 'pititi.lists.v1'
const ITEMS = 'pititi.listitems.v1'
const RECS = 'pititi.recs.v1'
const MUTES = 'pititi.mutes.v1'
const KEYS = [WATCHES, PEOPLE, REACTIONS, COMMENTS, HOUSEHOLDS, LISTS, ITEMS, RECS, MUTES]

const DEFAULT_PEOPLE: Person[] = [
  { id: 'local-leandro', name: 'Leandro', userId: null, isAdmin: true },
  { id: 'local-ana', name: 'Ana', userId: null, isAdmin: false },
]

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Older single-phone data kept Up Next as its own list: turn it into the built-in list once. */
function migrateUpNext(lists: WatchList[], items: ListItem[]): { lists: WatchList[]; items: ListItem[] } {
  if (lists.some((l) => l.isDefault)) return { lists, items }
  const old = readJson<{ showId: number; showName: string; poster: string | null; network: string | null; genres: string[]; year: string | null; runtime: number | null; addedBy: string | null; wantedBy: string[]; createdAt: string }[]>(UP_NEXT, [])
  const up: WatchList = {
    id: newId(),
    householdId: '',
    name: 'Up Next',
    emoji: '📌',
    visibility: 'household',
    sharedWith: [],
    askVotes: false,
    isDefault: true,
    createdBy: null,
    createdAt: new Date().toISOString(),
  }
  const moved: ListItem[] = old.map((o) => ({
    id: newId(),
    listId: up.id,
    kind: 'tv',
    extId: o.showId,
    title: o.showName,
    poster: o.poster,
    year: o.year,
    genres: o.genres,
    runtime: o.runtime,
    network: o.network,
    addedBy: o.addedBy,
    votes: o.wantedBy,
    createdAt: o.createdAt,
  }))
  return { lists: [up, ...lists], items: [...items, ...moved] }
}

function read(): Snapshot {
  const { lists, items } = migrateUpNext(readJson<WatchList[]>(LISTS, []), readJson<ListItem[]>(ITEMS, []))
  return {
    watches: readJson<Watch[]>(WATCHES, []),
    people: readJson<Person[]>(PEOPLE, DEFAULT_PEOPLE),
    households: readJson<Household[]>(HOUSEHOLDS, []),
    lists,
    listItems: items,
    recommendations: readJson<Recommendation[]>(RECS, []),
    mutes: readJson<string[]>(MUTES, []),
    reactions: readJson<Reaction[]>(REACTIONS, []),
    comments: readJson<Comment[]>(COMMENTS, []),
    social: true,
  }
}

function write(snap: Snapshot) {
  localStorage.setItem(WATCHES, JSON.stringify(snap.watches))
  localStorage.setItem(PEOPLE, JSON.stringify(snap.people))
  localStorage.setItem(HOUSEHOLDS, JSON.stringify(snap.households ?? []))
  localStorage.setItem(LISTS, JSON.stringify(snap.lists ?? []))
  localStorage.setItem(ITEMS, JSON.stringify(snap.listItems ?? []))
  localStorage.setItem(RECS, JSON.stringify(snap.recommendations ?? []))
  localStorage.setItem(MUTES, JSON.stringify(snap.mutes ?? []))
  localStorage.setItem(REACTIONS, JSON.stringify(snap.reactions ?? []))
  localStorage.setItem(COMMENTS, JSON.stringify(snap.comments ?? []))
}

function update(fn: (s: Snapshot) => Partial<Snapshot>) {
  const snap = read()
  write({ ...snap, ...fn(snap) })
}

const code = () => Math.random().toString(16).slice(2, 10).toUpperCase()

/** Single-device mode, used when Supabase isn't configured (and for design previews). */
export const localStore: Store = {
  mode: 'local',
  async load() {
    const snap = read()
    write(snap)
    return snap
  },
  async save(w) {
    update((s) => ({ watches: [...s.watches.filter((x) => x.id !== w.id), w] }))
  },
  async remove(id) {
    update((s) => ({
      watches: s.watches.filter((x) => x.id !== id),
      reactions: s.reactions.filter((r) => r.watchId !== id),
      comments: s.comments.filter((c) => c.watchId !== id),
    }))
  },
  async addPerson(name, householdId = null) {
    const person: Person = { id: newId(), name, userId: null, isAdmin: false, householdId }
    update((s) => ({ people: [...s.people, person] }))
    return person
  },
  async renamePerson(id, name) {
    update((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, name } : p)) }))
  },
  async setViewer(id, viewer) {
    update((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, isViewer: viewer } : p)) }))
  },
  async addHousehold(name) {
    const household: Household = { id: newId(), name, shareLog: true }
    update((s) => ({ households: [...s.households, household] }))
    return { household, code: code() }
  },
  async updateHousehold(h) {
    update((s) => ({ households: s.households.map((x) => (x.id === h.id ? h : x)) }))
  },
  async householdCode() {
    return null
  },
  async renewHouseholdCode() {
    return code()
  },
  async movePerson(personId, householdId) {
    update((s) => ({ people: s.people.map((p) => (p.id === personId ? { ...p, householdId } : p)) }))
  },
  async saveList(l) {
    update((s) => ({ lists: [...s.lists.filter((x) => x.id !== l.id), l] }))
  },
  async removeList(id) {
    update((s) => ({ lists: s.lists.filter((x) => x.id !== id), listItems: s.listItems.filter((i) => i.listId !== id) }))
  },
  async addItem(item) {
    update((s) => ({ listItems: [...s.listItems.filter((i) => !(i.listId === item.listId && i.kind === item.kind && i.extId === item.extId)), item] }))
  },
  async removeItem(id) {
    update((s) => ({ listItems: s.listItems.filter((i) => i.id !== id) }))
  },
  async vote(itemId, personId) {
    let votes: string[] = []
    update((s) => ({
      listItems: s.listItems.map((i) => {
        if (i.id !== itemId) return i
        votes = i.votes.includes(personId) ? i.votes.filter((v) => v !== personId) : [...i.votes, personId]
        return { ...i, votes }
      }),
    }))
    return votes
  },
  async recommend(r) {
    update((s) => ({ recommendations: [...s.recommendations, r] }))
  },
  async answerRecommendation(id, status) {
    update((s) => ({ recommendations: s.recommendations.map((r) => (r.id === id ? { ...r, status } : r)) }))
  },
  async setMute(_personId, thread, muted) {
    update((s) => ({ mutes: muted ? [...new Set([...s.mutes, thread])] : s.mutes.filter((t) => t !== thread) }))
  },
  async setNotifyLevel(personId, level) {
    update((s) => ({ people: s.people.map((p) => (p.id === personId ? { ...p, notifyLevel: level } : p)) }))
  },
  async setEvening(personId, hour) {
    update((s) => ({ people: s.people.map((p) => (p.id === personId ? { ...p, eveningHour: hour } : p)) }))
  },
  async setReaction(r) {
    update((s) => {
      const rest = s.reactions.filter((x) => !(x.watchId === r.watchId && x.personId === r.personId && x.targetId === r.targetId))
      return { reactions: r.emoji ? [...rest, { ...r, emoji: r.emoji }] : rest }
    })
  },
  async addComment(c) {
    update((s) => ({ comments: [...s.comments.filter((x) => x.id !== c.id), c] }))
  },
  async removeComment(id) {
    update((s) => ({ comments: s.comments.filter((x) => x.id !== id) }))
  },
  // Single-phone mode has no server to send notifications from
  async savePush() {},
  async removePush() {},
  subscribe(onChange) {
    const handler = (e: StorageEvent) => KEYS.includes(e.key ?? '') && onChange()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}

/** Last synced copy, so cloud mode still opens offline. */
export const cache = { read, write }
