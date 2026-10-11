import type { Comment, Person, Reaction, UpNextItem, Watch } from '../types'

export interface Snapshot {
  watches: Watch[]
  people: Person[]
  upNext: UpNextItem[]
  reactions: Reaction[]
  comments: Comment[]
  /** False when the reactions/chat tables don't exist yet (migration 006 not run) */
  social: boolean
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
  /** Sets your reaction on someone's rating (null removes it) */
  setReaction(r: Omit<Reaction, 'emoji'> & { emoji: string | null }): Promise<void>
  addComment(c: Comment): Promise<void>
  removeComment(id: string): Promise<void>
  /** This phone's notification subscription (Web Push) */
  savePush(sub: PushSubscriptionJSON): Promise<void>
  removePush(endpoint: string): Promise<void>
  /** Called when data changes on another device. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void
}

export interface Session {
  email: string
  personId: string
  isAdmin: boolean
}
