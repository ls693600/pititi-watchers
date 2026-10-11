import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { Comment, Person, Reaction, UpNextItem, Watch } from '../types'
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
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

interface UpNextRow {
  id: string
  show_id: number
  show_name: string
  poster: string | null
  network: string | null
  genres: string[]
  year: string | null
  runtime: number | null
  added_by: string | null
  wanted_by: string[]
  created_at: string
}

const toUpNext = (r: UpNextRow): UpNextItem => ({
  id: r.id,
  showId: r.show_id,
  showName: r.show_name,
  poster: r.poster,
  network: r.network,
  genres: r.genres ?? [],
  year: r.year,
  runtime: r.runtime,
  addedBy: r.added_by,
  wantedBy: r.wanted_by ?? [],
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
  watch_id: string
  person_id: string
  body: string
  created_at: string
}

const toReaction = (r: ReactionRow): Reaction => ({ watchId: r.watch_id, personId: r.person_id, targetId: r.target_id, emoji: r.emoji })
const toComment = (r: CommentRow): Comment => ({ id: r.id, watchId: r.watch_id, personId: r.person_id, text: r.body, createdAt: r.created_at })

const toPerson = (r: PersonRow): Person => ({ id: r.id, name: r.name, userId: r.user_id, isAdmin: Boolean(r.is_admin), isViewer: Boolean(r.is_viewer) })

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  return client
}

/** Turns database errors raised by the join trigger into something a person can act on. */
function friendly(message: string): string {
  if (/invite_invalid/i.test(message)) return "That invite code isn't right. Ask someone in the family for the code in Settings."
  if (/profile_taken/i.test(message)) return 'That person already has an account. Sign in instead.'
  if (/name_required/i.test(message)) return 'Enter your name.'
  if (/already registered/i.test(message)) return 'That email already has an account. Sign in instead.'
  if (/database error/i.test(message)) return "Couldn't create the account. Check the invite code and try again."
  if (/invalid login/i.test(message)) return 'Wrong email or password.'
  return message
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession()
  const user = data.session?.user
  if (!user) return null
  // select * so this keeps working before and after the viewer column exists
  const { data: person, error } = await supabase().from('people').select('*').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (!person) throw new Error("This account isn't part of the family yet. Sign out and create an account with the invite code.")
  return { email: user.email ?? '', personId: person.id as string, isAdmin: Boolean(person.is_admin), isViewer: Boolean(person.is_viewer) }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendly(error.message))
  const s = await currentSession()
  if (!s) throw new Error('Sign-in did not return a session.')
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

export async function getInviteCode(): Promise<string> {
  const { data, error } = await supabase().from('household').select('invite_code').eq('id', 1).single()
  if (error) throw error
  return data.invite_code as string
}

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

/** Replaces the invite code; the old one stops working for new sign-ups. */
export async function renewInviteCode(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  const { error } = await supabase().from('household').update({ invite_code: code }).eq('id', 1)
  if (error) throw error
  return code
}

export const cloudStore: Store = {
  mode: 'cloud',
  async load() {
    const [w, r, p, u, rx, cm] = await Promise.all([
      supabase().from('watches').select('*'),
      supabase().from('ratings').select('watch_id, person_id, stars'),
      supabase().from('people').select('*').order('created_at'),
      supabase().from('up_next').select('*'),
      supabase().from('reactions').select('watch_id, person_id, target_id, emoji'),
      supabase().from('comments').select('id, watch_id, person_id, body, created_at').order('created_at'),
    ])
    if (w.error) throw w.error
    // Up Next is optional: a missing table (migration not run yet) must not take the whole app offline
    if (u.error) console.warn('Up Next unavailable:', u.error.message)
    // Reactions and chat are optional too (migration 006): the app just hides them
    const social = !rx.error && !cm.error
    if (!social) console.warn('Reactions/chat unavailable:', (rx.error ?? cm.error)?.message)
    if (r.error) throw r.error
    if (p.error) throw p.error
    const byWatch = new Map<string, Record<string, number>>()
    for (const row of r.data as RatingRow[]) {
      byWatch.set(row.watch_id, { ...byWatch.get(row.watch_id), [row.person_id]: row.stars })
    }
    const snap = {
      watches: (w.data as WatchRow[]).map((row) => fromRow(row, byWatch.get(row.id) ?? {})),
      people: (p.data as PersonRow[]).map(toPerson),
      upNext: u.error ? [] : (u.data as UpNextRow[]).map(toUpNext),
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
    if (!data?.length) throw new Error('Only Leandro or the person who added it can remove this.')
  },
  async addUpNext(item) {
    const { error } = await supabase().from('up_next').insert({
      id: item.id,
      show_id: item.showId,
      show_name: item.showName,
      poster: item.poster,
      network: item.network,
      genres: item.genres,
      year: item.year,
      runtime: item.runtime,
      wanted_by: item.wantedBy,
    })
    if (error?.code === '23505') throw new Error('That show is already in Up Next.')
    if (error) throw error
  },
  async toggleWant(itemId, personId) {
    const { data, error } = await supabase().rpc('toggle_want', { item: itemId, person: personId })
    if (error) throw error
    return (data as string[]) ?? []
  },
  async removeUpNext(id) {
    const { data, error } = await supabase().from('up_next').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only Leandro or the person who added it can remove this.')
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
    if (!data?.length) throw new Error('You can only remove your own messages.')
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
  async addPerson(name) {
    const { data, error } = await supabase().from('people').insert({ name }).select('id, name, user_id, is_admin').single()
    if (error) throw error
    return toPerson(data as PersonRow)
  },
  async setViewer(id, viewer) {
    const { data, error } = await supabase().from('people').update({ is_viewer: viewer }).eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only Leandro can change that.')
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'up_next' }, ping)
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
