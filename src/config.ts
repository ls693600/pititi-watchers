// Outside Vite (Playwright reading app code in Node) there is no import.meta.env
const env: Partial<Record<string, string>> = import.meta.env ?? {}
export const SUPABASE_URL = env.VITE_SUPABASE_URL
export const SUPABASE_KEY = env.VITE_SUPABASE_KEY
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY)

/**
 * Where the family opens the app. The ONE place to change if the app moves (new GitHub account or a custom domain):
 * set VITE_APP_URL in .env.local, or change the default here. See docs/HANDBOOK.md → "Moving the app".
 */
export const APP_URL = env.VITE_APP_URL || 'https://ls693600.github.io/pititi-watchers/'

/** The Supabase project's Edge Functions (tmdb, notify). Follows VITE_SUPABASE_URL; the default keeps tests and local mode working. */
export const FUNCTIONS_URL = `${SUPABASE_URL || 'https://pnazcanolltupqydemri.supabase.co'}/functions/v1`

/** Web Push public key (VAPID). Public by design; the private half lives only in Supabase secrets. */
export const PUSH_PUBLIC_KEY = 'BFx6HsjEZ9lpebOdhU3Dvkq78VsXAxV7hRqdxyxsyjjp8QEhxHAivldPl3YZXHO_7S_VIBLonYnyeQD93djL_5I'
