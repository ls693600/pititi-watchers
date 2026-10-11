import { newId, toggleWant } from '../logic'
import type { Comment, Person, Reaction, UpNextItem, Watch } from '../types'
import type { Snapshot, Store } from './store'

const WATCHES = 'pititi.watches.v2'
const PEOPLE = 'pititi.people.v2'
const UP_NEXT = 'pititi.upnext.v1'
const REACTIONS = 'pititi.reactions.v1'
const COMMENTS = 'pititi.comments.v1'

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

function read(): Snapshot {
  return {
    watches: readJson<Watch[]>(WATCHES, []),
    people: readJson<Person[]>(PEOPLE, DEFAULT_PEOPLE),
    upNext: readJson<UpNextItem[]>(UP_NEXT, []),
    reactions: readJson<Reaction[]>(REACTIONS, []),
    comments: readJson<Comment[]>(COMMENTS, []),
    social: true,
  }
}

function write(snap: Snapshot) {
  localStorage.setItem(WATCHES, JSON.stringify(snap.watches))
  localStorage.setItem(PEOPLE, JSON.stringify(snap.people))
  localStorage.setItem(UP_NEXT, JSON.stringify(snap.upNext))
  localStorage.setItem(REACTIONS, JSON.stringify(snap.reactions ?? []))
  localStorage.setItem(COMMENTS, JSON.stringify(snap.comments ?? []))
}

/** Single-device mode, used when Supabase isn't configured. */
export const localStore: Store = {
  mode: 'local',
  async load() {
    return read()
  },
  async save(w) {
    const snap = read()
    write({ ...snap, watches: [...snap.watches.filter((x) => x.id !== w.id), w] })
  },
  async remove(id) {
    const snap = read()
    write({
      ...snap,
      watches: snap.watches.filter((x) => x.id !== id),
      reactions: snap.reactions.filter((r) => r.watchId !== id),
      comments: snap.comments.filter((c) => c.watchId !== id),
    })
  },
  async addPerson(name) {
    const snap = read()
    const person = { id: newId(), name, userId: null, isAdmin: false }
    write({ ...snap, people: [...snap.people, person] })
    return person
  },
  async renamePerson(id, name) {
    const snap = read()
    write({ ...snap, people: snap.people.map((p) => (p.id === id ? { ...p, name } : p)) })
  },
  async addUpNext(item) {
    const snap = read()
    write({ ...snap, upNext: [...snap.upNext.filter((x) => x.showId !== item.showId), item] })
  },
  async toggleWant(itemId, personId) {
    const snap = read()
    let result: string[] = []
    const upNext = snap.upNext.map((x) => {
      if (x.id !== itemId) return x
      const next = toggleWant(x, personId)
      result = next.wantedBy
      return next
    })
    write({ ...snap, upNext })
    return result
  },
  async removeUpNext(id) {
    const snap = read()
    write({ ...snap, upNext: snap.upNext.filter((x) => x.id !== id) })
  },
  async setReaction(r) {
    const snap = read()
    const rest = snap.reactions.filter((x) => !(x.watchId === r.watchId && x.personId === r.personId && x.targetId === r.targetId))
    write({ ...snap, reactions: r.emoji ? [...rest, { ...r, emoji: r.emoji }] : rest })
  },
  async addComment(c) {
    const snap = read()
    write({ ...snap, comments: [...snap.comments.filter((x) => x.id !== c.id), c] })
  },
  async removeComment(id) {
    const snap = read()
    write({ ...snap, comments: snap.comments.filter((x) => x.id !== id) })
  },
  // Single-phone mode has no server to send notifications from
  async savePush() {},
  async removePush() {},
  subscribe(onChange) {
    const handler = (e: StorageEvent) => [WATCHES, PEOPLE, UP_NEXT, REACTIONS, COMMENTS].includes(e.key ?? '') && onChange()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}

/** Last synced copy, so cloud mode still opens offline. */
export const cache = { read, write }
