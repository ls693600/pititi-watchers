import type { Comment, Household, ListItem, Person, Reaction, Recommendation, Watch, WatchList } from '../types'

export interface Snapshot {
  watches: Watch[]
  people: Person[]
  households: Household[]
  lists: WatchList[]
  listItems: ListItem[]
  recommendations: Recommendation[]
  /** Chats this person muted ("family" or a log id) */
  mutes: string[]
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
  addPerson(name: string, householdId?: string | null): Promise<Person>
  renamePerson(id: string, name: string): Promise<void>
  /** Admin: make someone a viewer (read + chat only) or a full member */
  setViewer(id: string, viewer: boolean): Promise<void>
  // Households (admin creates them; each has its own invite code)
  addHousehold(name: string): Promise<{ household: Household; code: string }>
  updateHousehold(h: Household): Promise<void>
  householdCode(id: string): Promise<string | null>
  renewHouseholdCode(id: string): Promise<string>
  movePerson(personId: string, householdId: string | null): Promise<void>
  // Lists, items and votes
  saveList(l: WatchList): Promise<void>
  removeList(id: string): Promise<void>
  addItem(item: ListItem): Promise<void>
  removeItem(id: string): Promise<void>
  /** Toggles your vote and returns who has voted now */
  vote(itemId: string, personId: string): Promise<string[]>
  // Recommendations
  recommend(r: Recommendation): Promise<void>
  answerRecommendation(id: string, status: Recommendation['status']): Promise<void>
  // Notification preferences
  setMute(personId: string, thread: string, muted: boolean): Promise<void>
  setNotifyLevel(personId: string, level: 'all' | 'mine' | 'off'): Promise<void>
  /** Your evening reminder: an hour in your time zone, or null for off (also saves your language for notifications) */
  setEvening(personId: string, hour: number | null, lang: 'en' | 'pt'): Promise<void>
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
  isViewer: boolean
}
