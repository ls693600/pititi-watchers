// Pititi Watchers notifications (Supabase Edge Function "notify").
// Called by the database: a new chat message, or the daily new-episode check. Sends Web Push to family phones.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const SECRET = Deno.env.get('PITITI_HOOK_SECRET') ?? ''
webpush.setVapidDetails('https://ls693600.github.io/pititi-watchers/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
// Service role: reads everyone's phones to deliver; never leaves this function
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

interface Person { id: string; name: string }
interface Sub { endpoint: string; person_id: string; p256dh: string; auth: string }
interface Note { title: string; body: string; open: string; tag: string }

const short = (t: string, n = 120) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (text: string, people: Person[]) =>
  people.filter((p) => new RegExp(`(^|\\s)@${escapeRe(p.name)}(?![\\p{L}\\p{N}])`, 'iu').test(text)).map((p) => p.id)

async function deliver(subs: Sub[], noteFor: (personId: string) => Note | null): Promise<number> {
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      const note = noteFor(s.person_id)
      if (!note) return
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(note), { TTL: 60 * 60 * 24 })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // The phone turned notifications off or the app was removed: forget it
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        else console.error('push failed', code, (e as Error).message)
      }
    }),
  )
  return sent
}

async function onComment(id: string) {
  const { data: c } = await db.from('comments').select('id, watch_id, person_id, body').eq('id', id).single()
  if (!c) return { sent: 0 }
  const [{ data: people }, { data: subs }, watchRes] = await Promise.all([
    db.from('people').select('id, name'),
    db.from('push_subscriptions').select('endpoint, person_id, p256dh, auth').neq('person_id', c.person_id),
    c.watch_id ? db.from('watches').select('id, show_name, status, watched_by').eq('id', c.watch_id).single() : Promise.resolve({ data: null }),
  ])
  const w = watchRes.data as { id: string; show_name: string; status: string; watched_by: string[] } | null
  const { data: ratings } = w ? await db.from('ratings').select('person_id').eq('watch_id', w.id) : { data: [] }
  const rated = new Set((ratings ?? []).map((r: { person_id: string }) => r.person_id))
  const all = (people ?? []) as Person[]
  const author = all.find((p) => p.id === c.person_id)?.name ?? 'Someone'
  const tagged = new Set(mentions(c.body, all))
  const where = w ? w.show_name : 'Family chat'
  const open = `thread:${c.watch_id ?? 'family'}`
  const sent = await deliver((subs ?? []) as Sub[], (personId) => {
    // Same rule as the app: a finished show you haven't rated yet doesn't show the words
    const hidden = w && w.status === 'done' && w.watched_by.includes(personId) && !rated.has(personId)
    const title = tagged.has(personId) ? `${author} mentioned you · ${where}` : where
    return { title, body: hidden ? `${author} wrote about it. Rate it to read.` : `${author}: ${short(c.body)}`, open, tag: open }
  })
  return { sent }
}

/** Shows you're watching with a new episode out today (TVmaze dates, Eastern time). */
async function reminders() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
  const [{ data: watches }, { data: subs }] = await Promise.all([
    db.from('watches').select('id, show_id, show_name, watched_by, updated_at').eq('status', 'watching'),
    db.from('push_subscriptions').select('endpoint, person_id, p256dh, auth'),
  ])
  // One log per show (the latest), so a show never pings twice
  const byShow = new Map<number, { id: string; show_id: number; show_name: string; watched_by: string[]; updated_at: string }>()
  for (const w of watches ?? []) if (!byShow.has(w.show_id) || byShow.get(w.show_id)!.updated_at < w.updated_at) byShow.set(w.show_id, w)
  const due: { w: { id: string; show_name: string; watched_by: string[] }; ep: { season: number; number: number; name: string } }[] = []
  for (const w of byShow.values()) {
    try {
      const res = await fetch(`https://api.tvmaze.com/shows/${w.show_id}?embed=nextepisode`)
      const show = await res.json()
      const ep = show?._embedded?.nextepisode
      if (ep?.airdate === today) due.push({ w, ep })
    } catch {
      // TVmaze hiccup: no reminder for that show today
    }
  }
  let sent = 0
  for (const { w, ep } of due) {
    sent += await deliver(((subs ?? []) as Sub[]).filter((s) => w.watched_by.includes(s.person_id)), () => ({
      title: `New episode today · ${w.show_name}`,
      body: `S${ep.season} · E${ep.number}${ep.name ? ` “${short(ep.name, 60)}”` : ''} is out. Couch time?`,
      open: `show:${w.id}`,
      tag: `ep:${w.id}`,
    }))
  }
  return { checked: byShow.size, due: due.length, sent }
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-pititi-secret') !== SECRET) return new Response('Unauthorized', { status: 401 })
  try {
    const body = await req.json()
    const result = body.type === 'comment' && typeof body.id === 'string' ? await onComment(body.id) : body.type === 'reminders' ? await reminders() : null
    if (!result) return new Response('Unknown request', { status: 400 })
    return Response.json(result)
  } catch (e) {
    console.error(e)
    return new Response('Error', { status: 500 })
  }
})
