import type { Person, UpNextItem, Watch } from '../types'

export interface Snapshot {
  watches: Watch[]
  people: Person[]
  upNext: UpNextItem[]
}

export interface Store {
  mode: 'local' | 'cloud'
  load(): Promise<Snapshot>
  save(w: Watch): Promise<void>
  remove(id: string): Promise<void>
  addPerson(name: string): Promise<Person>
  renamePerson(id: string, name: string): Promise<void>
  addUpNext(item: UpNextItem): Promise<void>
  /** Toggles one person's heart and returns the new list of who wants it */
  toggleWant(itemId: string, personId: string): Promise<string[]>
  removeUpNext(id: string): Promise<void>
  /** Called when data changes on another device. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void
}

export interface Session {
  email: string
  personId: string
  isAdmin: boolean
}
