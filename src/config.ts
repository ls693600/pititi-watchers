export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY)
