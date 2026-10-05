import { newId } from '../logic'
import type { Person, Watch } from '../types'
import type { Snapshot, Store } from './store'

const WATCHES = 'pititi.watches.v2'
const PEOPLE = 'pititi.people.v2'

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
  return { watches: readJson<Watch[]>(WATCHES, []), people: readJson<Person[]>(PEOPLE, DEFAULT_PEOPLE) }
}

function write(snap: Snapshot) {
  localStorage.setItem(WATCHES, JSON.stringify(snap.watches))
  localStorage.setItem(PEOPLE, JSON.stringify(snap.people))
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
    write({ ...snap, watches: snap.watches.filter((x) => x.id !== id) })
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
  subscribe(onChange) {
    const handler = (e: StorageEvent) => (e.key === WATCHES || e.key === PEOPLE) && onChange()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}

/** Last synced copy, so cloud mode still opens offline. */
export const cache = { read, write }
