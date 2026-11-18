import type { Comment, CouchPhoto, EpisodeReaction, Guess, MovieNight, NightVote, PartyAnswer, PartyMessage, Prediction, WatchParty, Household, ListItem, Person, Reaction, Recommendation, Watch, WatchList } from '../types'

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
  /** Everyone's emoji per episode */
  episodeReactions: EpisodeReaction[]
  /** False until migration 013 is run: "how was this episode?" stays hidden */
  episodeFx: boolean
  photos: CouchPhoto[]
  /** False until migration 014 is run: couch night photos stay hidden */
  photosOn: boolean
  predictions: Prediction[]
  /** Your own guesses, and the others' once they're open (the server keeps the rest sealed) */
  guesses: Guess[]
  /** False until migration 017 is run: predictions stay hidden */
  predictOn: boolean
  nights: MovieNight[]
  /** Your votes, and the others' on titles you've voted on too (the server enforces it) */
  nightVotes: NightVote[]
  /** False until migration 018 is run: Decide together stays hidden */
  nightOn: boolean
}

export interface Parties {
  parties: WatchParty[]
  answers: PartyAnswer[]
  messages: PartyMessage[]
  /** False until migration 019 is run: watch parties stay hidden */
  on: boolean
}

export interface Store {
  mode: 'local' | 'cloud'
  load(): Promise<Snapshot>
  /** `before`: the copy this change started from. Only what changed is sent (null: a new log, sent whole). */
  save(w: Watch, before?: Watch | null): Promise<void>
  remove(id: string): Promise<void>
  /** Undo a removal. True: it came back with everyone's chat, reactions and photos (021); false: re-send them. */
  undoRemove(w: Watch): Promise<boolean>
  /** Merge: removes the copy. True: its chat, reactions and photos moved to the kept log (021). */
  mergeInto(keepId: string, dropId: string): Promise<boolean>
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
  /** Your emoji on an episode (null removes it) */
  setEpisodeReaction(r: Omit<EpisodeReaction, 'emoji'> & { emoji: EpisodeReaction['emoji'] | null }): Promise<void>
  /** Uploads the (already shrunk) photo and returns it with a link to show it */
  addPhoto(p: Omit<CouchPhoto, 'path' | 'url'>, image: Blob): Promise<CouchPhoto>
  /** Removes the photo and its file */
  removePhoto(p: CouchPhoto): Promise<void>
  /** Puts back a photo's row (Undo on removing its log; the file was kept) */
  restorePhoto(p: CouchPhoto): Promise<void>
  addPrediction(p: Prediction, first: Guess): Promise<void>
  /** Your guess (new or changed), only before the reveal */
  setGuess(g: Guess): Promise<void>
  /** After the reveal: mark someone's guess right, wrong, or clear it */
  judgeGuess(predictionId: string, personId: string, verdict: Guess['verdict']): Promise<void>
  removePrediction(id: string): Promise<void>
  // Watch parties (019): loaded and synced on their own, so a busy party chat doesn't reload everything
  loadParties(): Promise<Parties>
  subscribeParties(onChange: () => void): () => void
  createParty(p: WatchParty): Promise<void>
  answerParty(a: PartyAnswer): Promise<void>
  /** start / pause / resume / end / cancel; returns the party and the server's clock (ms) */
  partyControl(id: string, action: 'start' | 'pause' | 'resume' | 'end' | 'cancel', atSec?: number | null, who?: { me: string; household: string | null }): Promise<{ party: WatchParty | null; serverNow: number }>
  sendPartyMessage(m: PartyMessage): Promise<void>
  serverNow(): Promise<number>
  startNight(n: MovieNight): Promise<void>
  voteNight(v: NightVote): Promise<void>
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
