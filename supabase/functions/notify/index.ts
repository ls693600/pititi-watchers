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

interface Member { id: string; name: string; household_id: string | null; notify_level: string | null }

async function circle(): Promise<{ people: Member[]; mutes: Set<string> }> {
  const [{ data: people }, { data: mutes }] = await Promise.all([
    db.from('people').select('*'),
    db.from('chat_mutes').select('person_id, thread'),
  ])
  return {
    people: ((people ?? []) as Member[]).map((p) => ({ ...p, notify_level: p.notify_level ?? 'all' })),
    mutes: new Set(((mutes ?? []) as { person_id: string; thread: string }[]).map((m) => `${m.person_id}:${m.thread}`)),
  }
}

async function subsFor(ids: string[]): Promise<Sub[]> {
  if (!ids.length) return []
  const { data } = await db.from('push_subscriptions').select('endpoint, person_id, p256dh, auth').in('person_id', ids)
  return (data ?? []) as Sub[]
}

async function onComment(id: string) {
  const { data: c } = await db.from('comments').select('id, watch_id, person_id, body').eq('id', id).single()
  if (!c) return { sent: 0 }
  const [{ people, mutes }, watchRes] = await Promise.all([
    circle(),
    c.watch_id ? db.from('watches').select('id, show_name, status, watched_by, household_id').eq('id', c.watch_id).single() : Promise.resolve({ data: null }),
  ])
  const w = watchRes.data as { id: string; show_name: string; status: string; watched_by: string[]; household_id: string } | null
  const { data: home } = w ? await db.from('households').select('share_log').eq('id', w.household_id).single() : { data: null }
  const { data: ratings } = w ? await db.from('ratings').select('person_id').eq('watch_id', w.id) : { data: [] }
  const rated = new Set((ratings ?? []).map((r: { person_id: string }) => r.person_id))
  const author = people.find((p) => p.id === c.person_id)?.name ?? 'Someone'
  const tagged = new Set(mentions(c.body, people))
  const thread = c.watch_id ?? 'family'
  // Who may see this chat: everyone for the Family chat; for a show, its household (and the circle if it shares its log)
  const recipients = people.filter((p) => {
    if (p.id === c.person_id || p.notify_level === 'off') return false
    if (w && p.household_id !== w.household_id && !home?.share_log) return false
    if (tagged.has(p.id)) return true
    return p.notify_level === 'all' && !mutes.has(`${p.id}:${thread}`)
  })
  const where = w ? w.show_name : 'Family chat'
  const open = `thread:${thread}`
  const sent = await deliver(await subsFor(recipients.map((p) => p.id)), (personId) => {
    // Same rule as the app: a finished show you haven't rated yet doesn't show the words
    const hidden = w && w.status === 'done' && w.watched_by.includes(personId) && !rated.has(personId)
    const title = tagged.has(personId) ? `${author} mentioned you · ${where}` : where
    return { title, body: hidden ? `${author} wrote about it. Rate it to read.` : `${author}: ${short(c.body)}`, open, tag: open }
  })
  return { sent }
}

async function onRecommendation(id: string) {
  const { data: r } = await db.from('recommendations').select('*').eq('id', id).single()
  if (!r) return { sent: 0 }
  const { people } = await circle()
  const to = people.find((p) => p.id === r.to_person)
  if (!to || to.notify_level === 'off') return { sent: 0 }
  const from = people.find((p) => p.id === r.from_person)?.name ?? 'Someone'
  const sent = await deliver(await subsFor([to.id]), () => ({
    title: `${from} recommends a ${r.kind === 'movie' ? 'movie' : 'show'}`,
    body: `${r.title}${r.year ? ` (${r.year})` : ''}${r.note ? ` · “${short(r.note, 80)}”` : ''}`,
    open: 'recs',
    tag: `rec:${r.id}`,
  }))
  return { sent }
}

async function onVoteRequest(id: string) {
  const { data: l } = await db.from('lists').select('*').eq('id', id).single()
  if (!l || !l.ask_votes) return { sent: 0 }
  const { people } = await circle()
  const asker = people.find((p) => p.id === l.created_by)
  const recipients = people.filter((p) => {
    if (p.id === l.created_by || p.notify_level === 'off') return false
    if (l.visibility === 'circle') return true
    if (l.visibility === 'people') return (l.shared_with as string[]).includes(p.id) || p.household_id === l.household_id
    return p.household_id === l.household_id
  })
  const sent = await deliver(await subsFor(recipients.map((p) => p.id)), () => ({
    title: `Help pick ${l.emoji}`,
    body: `${asker?.name ?? 'Someone'} asks: ${short(l.name, 60)}. Tap to vote.`,
    open: `list:${l.id}`,
    tag: `votes:${l.id}`,
  }))
  return { sent }
}

/** Shows you're watching with a new episode out today (TVmaze dates, Eastern time). */
async function reminders() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
  const [{ data: watches }, { data: subs }] = await Promise.all([
    db.from('watches').select('id, show_id, show_name, watched_by, updated_at').eq('status', 'watching').eq('kind', 'tv'),
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
  const back = await premieres(today, (subs ?? []) as Sub[])
  return { checked: byShow.size, due: due.length, sent: sent + back.sent, premieres: back.due }
}

/**
 * "It's back": a show you finished starts a new season today. TVmaze's schedule for today (TV and streaming)
 * is matched against each household's finished shows, so it costs a handful of calls however many shows you have.
 */
async function premieres(today: string, subs: Sub[]) {
  const urls = ['US', 'GB', 'CA', 'BR'].map((c) => `https://api.tvmaze.com/schedule?date=${today}&country=${c}`).concat(`https://api.tvmaze.com/schedule/web?date=${today}`)
  const starts = new Map<number, number>()
  for (const url of urls) {
    try {
      const eps = (await (await fetch(url)).json()) as { season: number; number: number; type?: string; show?: { id: number }; _embedded?: { show?: { id: number } } }[]
      for (const e of eps) {
        const id = e.show?.id ?? e._embedded?.show?.id
        if (id && e.number === 1 && e.season > 1 && (e.type ?? 'regular') === 'regular') starts.set(id, e.season)
      }
    } catch {
      // That schedule didn't load: fewer premieres today, never wrong ones
    }
  }
  if (!starts.size) return { due: 0, sent: 0 }
  const [{ data: logs }, { data: people }] = await Promise.all([
    db.from('watches').select('id, show_id, show_name, season, status, watched_by, household_id').eq('kind', 'tv').in('show_id', [...starts.keys()]),
    db.from('people').select('id, notify_level, lang'),
  ])
  const who = new Map(((people ?? []) as { id: string; notify_level: string | null; lang: string | null }[]).map((p) => [p.id, p]))
  // Each household's latest season of the show; only finished shows, one season behind the premiere
  const heads = new Map<string, { id: string; show_id: number; show_name: string; season: number; status: string; watched_by: string[] }>()
  const watching = new Set<string>()
  for (const w of (logs ?? []) as { id: string; show_id: number; show_name: string; season: number; status: string; watched_by: string[]; household_id: string }[]) {
    const k = `${w.household_id}:${w.show_id}`
    if (w.status === 'watching') watching.add(k)
    if (!heads.has(k) || heads.get(k)!.season < w.season) heads.set(k, w)
  }
  let due = 0
  let sent = 0
  for (const [k, w] of heads) {
    const season = starts.get(w.show_id)!
    if (watching.has(k) || w.status !== 'done' || w.season >= season) continue
    due++
    const to = w.watched_by.filter((id) => who.get(id)?.notify_level !== 'off')
    sent += await deliver(subs.filter((s) => to.includes(s.person_id)), (personId) => {
      const pt = who.get(personId)?.lang === 'pt'
      return {
        title: pt ? `Voltou! ${w.show_name} 🎉` : `${w.show_name} is back 🎉`,
        body: pt ? `A temporada ${season} estreia hoje. Bora maratonar?` : `Season ${season} starts today. Couch time?`,
        open: `show:${w.id}`,
        tag: `back:${w.show_id}:${season}`,
      }
    })
  }
  return { due, sent }
}

interface EveningPerson { id: string; household_id: string | null; evening_hour: number | null; tz: string | null; notify_level: string | null; lang: string | null }

/** Local hour and date for a person (their phone's time zone; Eastern if unknown). */
function localNow(tz: string | null): { hour: number; date: string } {
  const zone = tz || 'America/Toronto'
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date())
    const get = (k: string) => parts.find((p) => p.type === k)?.value ?? ''
    return { hour: Number(get('hour')) % 24, date: `${get('year')}-${get('month')}-${get('day')}` }
  } catch {
    return localNow('America/Toronto')
  }
}

/** "Did you watch something today?": only at each person's chosen hour, only if they're mid-show and marked nothing today. */
async function evening() {
  const { data: people } = await db.from('people').select('id, household_id, evening_hour, tz, notify_level, lang').not('evening_hour', 'is', null)
  const due = ((people ?? []) as EveningPerson[]).filter((p) => p.notify_level !== 'off' && p.household_id && localNow(p.tz).hour === p.evening_hour)
  if (!due.length) return { due: 0, sent: 0 }
  const { data: watches } = await db
    .from('watches')
    .select('id, show_name, household_id, watched_by, status, updated_at')
    .in('household_id', [...new Set(due.map((p) => p.household_id!))])
  let sent = 0
  for (const p of due) {
    const mine = ((watches ?? []) as { show_name: string; household_id: string; watched_by: string[]; status: string; updated_at: string }[]).filter(
      (w) => w.household_id === p.household_id && w.watched_by.includes(p.id),
    )
    const watching = mine.filter((w) => w.status === 'watching').sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    if (!watching.length) continue
    // Already marked something today (their date): no reminder
    const today = localNow(p.tz).date
    const zone = p.tz || 'America/Toronto'
    const markedToday = mine.some((w) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(w.updated_at)) === today)
    if (markedToday) continue
    const names = watching.slice(0, 2).map((w) => w.show_name).join(', ') + (watching.length > 2 ? '…' : '')
    sent += await deliver(await subsFor([p.id]), () => ({
      title: p.lang === 'pt' ? 'Assistiram algo hoje? 📺' : 'Watched something today? 📺',
      body: p.lang === 'pt' ? `${names} · toque para marcar` : `${names} · tap to mark it`,
      open: 'quickmark',
      tag: 'evening',
    }))
  }
  return { due: due.length, sent }
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-pititi-secret') !== SECRET) return new Response('Unauthorized', { status: 401 })
  try {
    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id : null
    const result =
      body.type === 'comment' && id ? await onComment(id)
      : body.type === 'recommendation' && id ? await onRecommendation(id)
      : body.type === 'votes' && id ? await onVoteRequest(id)
      : body.type === 'reminders' ? await reminders()
      : body.type === 'evening' ? await evening()
      : null
    if (!result) return new Response('Unknown request', { status: 400 })
    return Response.json(result)
  } catch (e) {
    console.error(e)
    return new Response('Error', { status: 500 })
  }
})
