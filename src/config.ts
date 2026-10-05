import type { Person } from './types'

export const PEOPLE: Person[] = [
  { id: 'p1', name: 'Leandro' },
  { id: 'p2', name: 'Ana' },
]

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY)
