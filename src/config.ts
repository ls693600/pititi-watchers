export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY)

/** Web Push public key (VAPID). Public by design; the private half lives only in Supabase secrets. */
export const PUSH_PUBLIC_KEY = 'BFx6HsjEZ9lpebOdhU3Dvkq78VsXAxV7hRqdxyxsyjjp8QEhxHAivldPl3YZXHO_7S_VIBLonYnyeQD93djL_5I'
