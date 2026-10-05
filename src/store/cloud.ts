import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { Person, Watch } from '../types'
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
  ratings,
  isRewatch: r.is_rewatch,
  notes: r.notes ?? '',
  createdBy: r.created_by ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const toPerson = (r: PersonRow): Person => ({ id: r.id, name: r.name, userId: r.user_id, isAdmin: Boolean(r.is_admin) })

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
  const { data: person, error } = await supabase().from('people').select('id, is_admin').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (!person) throw new Error("This account isn't part of the family yet. Sign out and create an account with the invite code.")
  return { email: user.email ?? '', personId: person.id as string, isAdmin: Boolean(person.is_admin) }
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
    const [w, r, p] = await Promise.all([
      supabase().from('watches').select('*'),
      supabase().from('ratings').select('watch_id, person_id, stars'),
      supabase().from('people').select('id, name, user_id, is_admin').order('created_at'),
    ])
    if (w.error) throw w.error
    if (r.error) throw r.error
    if (p.error) throw p.error
    const byWatch = new Map<string, Record<string, number>>()
    for (const row of r.data as RatingRow[]) {
      byWatch.set(row.watch_id, { ...byWatch.get(row.watch_id), [row.person_id]: row.stars })
    }
    const snap = {
      watches: (w.data as WatchRow[]).map((row) => fromRow(row, byWatch.get(row.id) ?? {})),
      people: (p.data as PersonRow[]).map(toPerson),
    }
    cache.write(snap)
    return snap
  },
  async save(w) {
    const { error } = await supabase().from('watches').upsert(toRow(w))
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
  async addPerson(name) {
    const { data, error } = await supabase().from('people').insert({ name }).select('id, name, user_id, is_admin').single()
    if (error) throw error
    return toPerson(data as PersonRow)
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
      .subscribe()
    return () => {
      clearTimeout(t)
      supabase().removeChannel(channel)
    }
  },
}
