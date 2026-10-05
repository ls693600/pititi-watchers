import type { Person, Watch } from '../types'

export interface Snapshot {
  watches: Watch[]
  people: Person[]
}

export interface Store {
  mode: 'local' | 'cloud'
  load(): Promise<Snapshot>
  save(w: Watch): Promise<void>
  remove(id: string): Promise<void>
  addPerson(name: string): Promise<Person>
  renamePerson(id: string, name: string): Promise<void>
  /** Called when data changes on another device. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void
}

export interface Session {
  email: string
  personId: string
  isAdmin: boolean
}
