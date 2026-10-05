import type { PersonId, Watch } from '../types'

export interface Store {
  mode: 'local' | 'cloud'
  load(): Promise<Watch[]>
  save(w: Watch): Promise<void>
  remove(id: string): Promise<void>
  /** Called when data changes on another device. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void
}

export interface Session {
  email: string
  person: PersonId
}
