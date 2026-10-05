import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { PersonId, Watch } from '../types'
import { cache } from './local'
import type { Session, Store } from './store'

interface Row {
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
  rating_p1: number | null
  rating_p2: number | null
  is_rewatch: boolean
  notes: string
  created_at: string
  updated_at: string
}

const toRow = (w: Watch): Row => ({
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
  rating_p1: w.ratings.p1,
  rating_p2: w.ratings.p2,
  is_rewatch: w.isRewatch,
  notes: w.notes,
  created_at: w.createdAt,
  updated_at: w.updatedAt,
})

const fromRow = (r: Row): Watch => ({
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
  ratings: { p1: r.rating_p1, p2: r.rating_p2 },
  isRewatch: r.is_rewatch,
  notes: r.notes ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  return client
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession()
  const user = data.session?.user
  if (!user) return null
  const { data: member, error } = await supabase()
    .from('members')
    .select('person')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!member) throw new Error('This account is not part of the household yet. Add it to the members table.')
  return { email: user.email ?? '', person: member.person as PersonId }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw error
  const s = await currentSession()
  if (!s) throw new Error('Sign-in did not return a session.')
  return s
}

export async function signOut() {
  await supabase().auth.signOut()
}

export const cloudStore: Store = {
  mode: 'cloud',
  async load() {
    const { data, error } = await supabase().from('watches').select('*')
    if (error) throw error
    const list = (data as Row[]).map(fromRow)
    cache.write(list)
    return list
  },
  async save(w) {
    const { error } = await supabase().from('watches').upsert(toRow(w))
    if (error) throw error
  },
  async remove(id) {
    const { error } = await supabase().from('watches').delete().eq('id', id)
    if (error) throw error
  },
  subscribe(onChange) {
    const channel = supabase()
      .channel('watches-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watches' }, onChange)
      .subscribe()
    return () => {
      supabase().removeChannel(channel)
    }
  },
}
