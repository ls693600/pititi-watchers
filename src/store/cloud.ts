import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { Comment, ListItem, Person, Reaction, Recommendation, Watch, WatchList } from '../types'
import { t } from '../i18n'
import { cache } from './local'
import type { Session, Store } from './store'

interface WatchRow {
  id: string
  show_id: number
  show_name: string
  poster: string | null
  network: string | null
  genres: string[]
  year: string | null
  season: number
  episodes_watched: number
  total_episodes: number | null
  runtime: number | null
  month: string
  status: Watch['status']
  watched_by: string[]
  episodes_by_month?: Record<string, number> | null
  created_by?: string | null
  kind?: 'tv' | 'movie'
  household_id?: string | null
  is_rewatch: boolean
  notes: string
  created_at: string
  updated_at: string
}

interface RatingRow {
  watch_id: string
  person_id: string
  stars: number
}

interface PersonRow {
  id: string
  name: string
  user_id: string | null
  is_admin: boolean
  is_viewer?: boolean
  household_id?: string | null
  notify_level?: 'all' | 'mine' | 'off'
}

const toRow = (w: Watch): WatchRow => ({
  id: w.id,
  show_id: w.showId,
  show_name: w.showName,
  poster: w.poster,
  network: w.network,
  genres: w.genres,
  year: w.year,
  season: w.season,
  episodes_watched: w.episodesWatched,
  total_episodes: w.totalEpisodes,
  runtime: w.runtime,
  month: w.month,
  status: w.status,
  watched_by: w.watchedBy,
  episodes_by_month: w.episodesByMonth ?? {},
  // Restoring a removed log (undo) keeps who added it; updates can't change it (trigger in 003)
  ...(w.createdBy ? { created_by: w.createdBy } : {}),
  kind: w.kind ?? 'tv',
  ...(w.householdId ? { household_id: w.householdId } : {}),
  is_rewatch: w.isRewatch,
  notes: w.notes,
  created_at: w.createdAt,
  updated_at: w.updatedAt,
})

const fromRow = (r: WatchRow, ratings: Record<string, number>): Watch => ({
  id: r.id,
  showId: r.show_id,
  showName: r.show_name,
  poster: r.poster,
  network: r.network,
  genres: r.genres ?? [],
  year: r.year,
  season: r.season,
  episodesWatched: r.episodes_watched,
  totalEpisodes: r.total_episodes,
  runtime: r.runtime,
  month: r.month,
  status: r.status,
  watchedBy: r.watched_by ?? [],
  episodesByMonth: r.episodes_by_month ?? {},
  ratings,
  isRewatch: r.is_rewatch,
  notes: r.notes ?? '',
  createdBy: r.created_by ?? null,
  kind: r.kind ?? 'tv',
  householdId: r.household_id ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

interface TitleRow {
  kind: 'tv' | 'movie'
  ext_id: number
  title: string
  poster: string | null
  year: string | null
  genres: string[] | null
  runtime: number | null
  network: string | null
}

const titleFrom = (r: TitleRow) => ({
  kind: r.kind,
  extId: r.ext_id,
  title: r.title,
  poster: r.poster,
  year: r.year,
  genres: r.genres ?? [],
  runtime: r.runtime,
  network: r.network,
})

const titleTo = (t: Omit<TitleRow, 'genres'> & { genres: string[] } | ListItem | Recommendation) =>
  'extId' in t
    ? { kind: t.kind, ext_id: t.extId, title: t.title, poster: t.poster, year: t.year, genres: t.genres, runtime: t.runtime, network: t.network }
    : t

interface ListRow {
  id: string
  household_id: string
  name: string
  emoji: string
  visibility: WatchList['visibility']
  shared_with: string[] | null
  ask_votes: boolean
  is_default: boolean
  created_by: string | null
  created_at: string
}

const toList = (r: ListRow): WatchList => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  emoji: r.emoji,
  visibility: r.visibility,
  sharedWith: r.shared_with ?? [],
  askVotes: r.ask_votes,
  isDefault: r.is_default,
  createdBy: r.created_by,
  createdAt: r.created_at,
})

interface ItemRow extends TitleRow {
  id: string
  list_id: string
  added_by: string | null
  votes: string[] | null
  created_at: string
}

const toItem = (r: ItemRow): ListItem => ({ ...titleFrom(r), id: r.id, listId: r.list_id, addedBy: r.added_by, votes: r.votes ?? [], createdAt: r.created_at })

interface RecRow extends TitleRow {
  id: string
  from_person: string
  to_person: string
  note: string
  status: Recommendation['status']
  created_at: string
}

const toRec = (r: RecRow): Recommendation => ({
  ...titleFrom(r),
  id: r.id,
  from: r.from_person,
  to: r.to_person,
  note: r.note,
  status: r.status,
  createdAt: r.created_at,
})

interface ReactionRow {
  watch_id: string
  person_id: string
  target_id: string
  emoji: string
}

interface CommentRow {
  id: string
  watch_id: string | null
  person_id: string
  body: string
  created_at: string
}

const toReaction = (r: ReactionRow): Reaction => ({ watchId: r.watch_id, personId: r.person_id, targetId: r.target_id, emoji: r.emoji })
const toComment = (r: CommentRow): Comment => ({ id: r.id, watchId: r.watch_id, personId: r.person_id, text: r.body, createdAt: r.created_at })

const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  userId: r.user_id,
  isAdmin: Boolean(r.is_admin),
  isViewer: Boolean(r.is_viewer),
  householdId: r.household_id ?? null,
  notifyLevel: r.notify_level ?? 'all',
})

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  return client
}

/** Turns database errors raised by the join trigger into something a person can act on. */
function friendly(message: string): string {
  if (/invite_invalid/i.test(message)) return t("That invite code isn't right. Ask someone in the family for the code in Settings.")
  if (/profile_taken/i.test(message)) return t('That person already has an account. Sign in instead.')
  if (/name_required/i.test(message)) return t('Enter your name.')
  if (/already registered/i.test(message)) return t('That email already has an account. Sign in instead.')
  if (/database error/i.test(message)) return t("Couldn't create the account. Check the invite code and try again.")
  if (/invalid login/i.test(message)) return t('Wrong email or password.')
  return message
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession()
  const user = data.session?.user
  if (!user) return null
  // select * so this keeps working before and after the viewer column exists
  const { data: person, error } = await supabase().from('people').select('*').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (!person) throw new Error(t("This account isn't part of the family yet. Sign out and create an account with the invite code."))
  return { email: user.email ?? '', personId: person.id as string, isAdmin: Boolean(person.is_admin), isViewer: Boolean(person.is_viewer) }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendly(error.message))
  const s = await currentSession()
  if (!s) throw new Error(t('Sign-in did not return a session.'))
  return s
}

export interface JoinOptions {
  valid: boolean
  profiles: { id: string; name: string }[]
}

/** Checks an invite code and lists family profiles that don't have an account yet. */
export async function joinOptions(code: string): Promise<JoinOptions> {
  const [valid, profiles] = await Promise.all([
    supabase().rpc('invite_valid', { code }),
    supabase().rpc('open_profiles', { code }),
  ])
  if (valid.error) throw valid.error
  if (profiles.error) throw profiles.error
  return { valid: Boolean(valid.data), profiles: (profiles.data as { id: string; name: string }[]) ?? [] }
}

export type JoinAs = { personId: string } | { name: string }

/** Creates an account and joins the family. Returns null when Supabase requires email confirmation first. */
export async function signUp(email: string, password: string, code: string, as: JoinAs): Promise<Session | null> {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: {
      data: { invite_code: code, ...('personId' in as ? { person_id: as.personId } : { name: as.name }) },
      emailRedirectTo: window.location.href.split('#')[0],
    },
  })
  if (error) throw new Error(friendly(error.message))
  if (!data.session) return null
  return currentSession()
}

export async function signOut() {
  await supabase().auth.signOut()
}

/** Your household's invite code (falls back to the old single family code before migration 008). */
export async function getInviteCode(): Promise<string> {
  const { data: me } = await supabase().from('people').select('*').eq('user_id', (await supabase().auth.getUser()).data.user?.id ?? '').maybeSingle()
  if (me?.household_id) {
    const { data, error } = await supabase().from('household_invites').select('code').eq('household_id', me.household_id).maybeSingle()
    if (!error && data) return data.code as string
  }
  const { data, error } = await supabase().from('household').select('invite_code').eq('id', 1).single()
  if (error) throw error
  return data.invite_code as string
}

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()

/** Code for viewers (see everything, chat, but can't change shows). Null before migration 007. */
export async function getViewerCode(): Promise<string | null> {
  const { data, error } = await supabase().from('household').select('*').eq('id', 1).single()
  if (error) throw error
  return (data.viewer_code as string | undefined) ?? null
}

export async function renewViewerCode(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  const { error } = await supabase().from('household').update({ viewer_code: code }).eq('id', 1)
  if (error) throw error
  return code
}

/** Replaces your household's invite code; the old one stops working for new sign-ups. */
export async function renewInviteCode(): Promise<string> {
  const { data: me } = await supabase().from('people').select('*').eq('user_id', (await supabase().auth.getUser()).data.user?.id ?? '').maybeSingle()
  const code = newCode()
  if (me?.household_id) {
    const { error } = await supabase().from('household_invites').update({ code }).eq('household_id', me.household_id)
    if (error) throw error
    return code
  }
  const { error } = await supabase().from('household').update({ invite_code: code }).eq('id', 1)
  if (error) throw error
  return code
}

export const cloudStore: Store = {
  mode: 'cloud',
  async load() {
    const optional = <T,>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] => {
      // A table from a newer migration that isn't there yet must not take the whole app offline
      if (res.error) console.warn(`${what} unavailable:`, res.error.message)
      return res.error ? [] : (res.data ?? [])
    }
    const [w, r, p, rx, cm, hh, ls, li, rc, mu] = await Promise.all([
      supabase().from('watches').select('*'),
      supabase().from('ratings').select('watch_id, person_id, stars'),
      supabase().from('people').select('*').order('created_at'),
      supabase().from('reactions').select('watch_id, person_id, target_id, emoji'),
      supabase().from('comments').select('id, watch_id, person_id, body, created_at').order('created_at'),
      supabase().from('households').select('*').order('created_at'),
      supabase().from('lists').select('*').order('created_at'),
      supabase().from('list_items').select('*'),
      supabase().from('recommendations').select('*').order('created_at', { ascending: false }),
      supabase().from('chat_mutes').select('thread'),
    ])
    if (w.error) throw w.error
    if (r.error) throw r.error
    if (p.error) throw p.error
    // Reactions and chat are optional too (migration 006): the app just hides them
    const social = !rx.error && !cm.error
    if (!social) console.warn('Reactions/chat unavailable:', (rx.error ?? cm.error)?.message)
    const byWatch = new Map<string, Record<string, number>>()
    for (const row of r.data as RatingRow[]) {
      byWatch.set(row.watch_id, { ...byWatch.get(row.watch_id), [row.person_id]: row.stars })
    }
    const snap = {
      watches: (w.data as WatchRow[]).map((row) => fromRow(row, byWatch.get(row.id) ?? {})),
      people: (p.data as PersonRow[]).map(toPerson),
      households: optional(hh, 'Households').map((h: { id: string; name: string; share_log: boolean }) => ({ id: h.id, name: h.name, shareLog: h.share_log })),
      lists: optional(ls, 'Lists').map((x) => toList(x as ListRow)),
      listItems: optional(li, 'List items').map((x) => toItem(x as ItemRow)),
      recommendations: optional(rc, 'Recommendations').map((x) => toRec(x as RecRow)),
      mutes: optional(mu, 'Mutes').map((m: { thread: string }) => m.thread),
      reactions: social ? (rx.data as ReactionRow[]).map(toReaction) : [],
      comments: social ? (cm.data as CommentRow[]).map(toComment) : [],
      social,
    }
    cache.write(snap)
    return snap
  },
  async save(w) {
    let { error } = await supabase().from('watches').upsert(toRow(w))
    if (error && /episodes_by_month/.test(error.message)) {
      // Database not migrated yet (005): save without the monthly breakdown rather than failing
      const row: Partial<WatchRow> = toRow(w)
      delete row.episodes_by_month
      ;({ error } = await supabase().from('watches').upsert(row))
    }
    if (error) throw error
    const rated = Object.entries(w.ratings)
    // Clear ratings that were removed, then write the current ones
    let del = supabase().from('ratings').delete().eq('watch_id', w.id)
    if (rated.length) del = del.not('person_id', 'in', `(${rated.map(([id]) => id).join(',')})`)
    const cleared = await del
    if (cleared.error) throw cleared.error
    if (rated.length) {
      const now = new Date().toISOString()
      const { error: rErr } = await supabase()
        .from('ratings')
        .upsert(rated.map(([person_id, stars]) => ({ watch_id: w.id, person_id, stars, updated_at: now })))
      if (rErr) throw rErr
    }
  },
  async remove(id) {
    // RLS silently skips rows you may not delete, so check something was actually removed
    const { data, error } = await supabase().from('watches').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(t('Only Leandro or the person who added it can remove this.'))
  },
  async setReaction(r) {
    const key = { watch_id: r.watchId, person_id: r.personId, target_id: r.targetId }
    const { error } = r.emoji
      ? await supabase().from('reactions').upsert({ ...key, emoji: r.emoji })
      : await supabase().from('reactions').delete().match(key)
    if (error) throw error
  },
  async addComment(c) {
    const { error } = await supabase()
      .from('comments')
      .insert({ id: c.id, watch_id: c.watchId, person_id: c.personId, body: c.text, created_at: c.createdAt })
    if (error) throw error
  },
  async removeComment(id) {
    const { data, error } = await supabase().from('comments').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(t('You can only remove your own messages.'))
  },
  async savePush(sub) {
    const { error } = await supabase()
      .from('push_subscriptions')
      .upsert({ endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' })
    if (error) throw error
  },
  async removePush(endpoint) {
    const { error } = await supabase().from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) throw error
  },
  async addHousehold(name) {
    const { data, error } = await supabase().from('households').insert({ name }).select('*').single()
    if (error) throw error
    const code = newCode()
    const inv = await supabase().from('household_invites').insert({ household_id: data.id, code })
    if (inv.error) throw inv.error
    return { household: { id: data.id as string, name: data.name as string, shareLog: Boolean(data.share_log) }, code }
  },
  async updateHousehold(h) {
    const { error } = await supabase().from('households').update({ name: h.name, share_log: h.shareLog }).eq('id', h.id)
    if (error) throw error
  },
  async householdCode(id) {
    const { data, error } = await supabase().from('household_invites').select('code').eq('household_id', id).maybeSingle()
    if (error) throw error
    return (data?.code as string | undefined) ?? null
  },
  async renewHouseholdCode(id) {
    const code = newCode()
    const { error } = await supabase().from('household_invites').update({ code }).eq('household_id', id)
    if (error) throw error
    return code
  },
  async movePerson(personId, householdId) {
    const { data, error } = await supabase().from('people').update({ household_id: householdId }).eq('id', personId).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(t('Only Leandro can move people between households.'))
  },
  async saveList(l) {
    const { error } = await supabase().from('lists').upsert({
      id: l.id,
      household_id: l.householdId,
      name: l.name,
      emoji: l.emoji,
      visibility: l.visibility,
      shared_with: l.sharedWith,
      ask_votes: l.askVotes,
      is_default: l.isDefault,
    })
    if (error) throw error
  },
  async removeList(id) {
    const { data, error } = await supabase().from('lists').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(t("Only your household can remove this list (Up Next can't be removed)."))
  },
  async addItem(item) {
    const { error } = await supabase().from('list_items').insert({ id: item.id, list_id: item.listId, votes: item.votes, ...titleTo(item) })
    if (error?.code === '23505') throw new Error(t("It's already on that list."))
    if (error) throw error
  },
  async removeItem(id) {
    const { data, error } = await supabase().from('list_items').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(t('Only the household that owns this list can remove things from it.'))
  },
  async vote(itemId) {
    const { data, error } = await supabase().rpc('toggle_vote', { item: itemId })
    if (error) throw error
    return (data as string[]) ?? []
  },
  async recommend(r) {
    const { error } = await supabase().from('recommendations').insert({ id: r.id, to_person: r.to, note: r.note, ...titleTo(r) })
    if (error) throw error
  },
  async answerRecommendation(id, status) {
    const { error } = await supabase().from('recommendations').update({ status }).eq('id', id)
    if (error) throw error
  },
  async setMute(_personId, thread, muted) {
    const { error } = muted
      ? await supabase().from('chat_mutes').upsert({ thread })
      : await supabase().from('chat_mutes').delete().eq('thread', thread)
    if (error) throw error
  },
  async setNotifyLevel(personId, level) {
    const { error } = await supabase().from('people').update({ notify_level: level }).eq('id', personId)
    if (error) throw error
  },
  async addPerson(name, householdId = null) {
    const { data, error } = await supabase().from('people').insert({ name, ...(householdId ? { household_id: householdId } : {}) }).select('*').single()
    if (error) throw error
    return toPerson(data as PersonRow)
  },
  async setViewer(id, viewer) {
    const { data, error } = await supabase().from('people').update({ is_viewer: viewer }).eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(t('Only Leandro can change that.'))
  },
  async renamePerson(id, name) {
    const { error } = await supabase().from('people').update({ name }).eq('id', id)
    if (error) throw error
  },
  subscribe(onChange) {
    // Several rows change per save (log + ratings); coalesce into one reload
    let t: ReturnType<typeof setTimeout> | undefined
    const ping = () => {
      clearTimeout(t)
      t = setTimeout(onChange, 300)
    }
    const channel = supabase()
      .channel('family-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watches' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations' }, ping)
      .subscribe()
    // Separate channel: if migration 006 hasn't been run, a failure here can't stop the main sync
    const social = supabase()
      .channel('family-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, ping)
      .subscribe()
    return () => {
      clearTimeout(t)
      supabase().removeChannel(channel)
      supabase().removeChannel(social)
    }
  },
}

export interface ProblemReport {
  id: string
  created_at: string
  person_id: string | null
  version: string
  screen: string
  message: string
  user_agent: string
}

/** Admin: problems reported from family phones in the last 30 days (newest first). */
export async function recentProblems(): Promise<ProblemReport[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await supabase()
    .from('client_errors')
    .select('id, created_at, person_id, version, screen, message, user_agent')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as ProblemReport[]
}

export async function clearProblems(): Promise<void> {
  const { error } = await supabase().from('client_errors').delete().gte('created_at', '1970-01-01')
  if (error) throw error
}
