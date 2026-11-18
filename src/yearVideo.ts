// "Our year on the couch" as a ~20 second vertical video (1080×1920) for the family WhatsApp group.
// This module is pure: the data → a timeline of scenes → a frame drawn on a canvas. Recording lives in
// src/lib/recordCanvas.ts and the buttons in src/components/YearVideo.tsx.
//
// Test hook: `window.__PITITI_VIDEO_SPEED__ = 10` makes the video 10× shorter (the e2e tests record ~2 s).
import { APP_URL } from './config'
import { t } from './i18n'
import { averageRating, episodeOfYear, kindOf, monthBuckets, yearReview } from './logic'
import { bigPoster } from './tvmaze'
import type { CouchPhoto, EpisodeReaction, Person, Watch } from './types'

export const VIDEO_W = 1080
export const VIDEO_H = 1920
/** What a full year adds up to; years with less to show stretch a little, never past TARGET × MAX_STRETCH */
export const TARGET_MS = 20_000
const MAX_STRETCH = 1.3
const MIN_SQUEEZE = 0.85

export interface VideoShow {
  name: string
  poster: string | null
  /** Family average (1–10), null if not everyone rated */
  avg: number | null
}

export interface VideoData {
  year: number
  soFar: boolean
  /** "Leandro & Ana" */
  names: string
  totals: { episodes: number; hours: number; series: number; movies: number; days: number }
  /** Best of the year, at most 3 */
  top: VideoShow[]
  episode: { show: string; poster: string | null; label: string; emojis: string; reactions: number } | null
  /** Couch photos, one per night, newest first, at most 3 */
  photos: string[]
  /** All nights with a photo (the album can show fewer) */
  nights: number
}

function names(people: Person[], ids: string[]): string {
  const list = people.filter((p) => ids.includes(p.id)).map((p) => p.name)
  return list.length <= 2 ? list.join(' & ') : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`
}

/** The same numbers the Year in Review slides show, packed for the video. */
export function yearVideoData(opts: {
  year: number
  watches: Watch[]
  people: Person[]
  episodeReactions?: EpisodeReaction[]
  photos?: CouchPhoto[]
  soFar?: boolean
  now?: Date
}): VideoData {
  const { year, watches, people, episodeReactions = [], photos = [] } = opts
  const ids = people.map((p) => p.id)
  const r = yearReview(watches, ids, year, opts.now)
  const inYear = (m: string) => m.startsWith(`${year}-`)
  const list = watches.filter((w) => inYear(w.month) || Object.keys(monthBuckets(w)).some(inYear))
  // One entry per show: rated ones first (best average), then the most watched
  const byShow = new Map<string, { w: Watch; avg: number | null; eps: number }>()
  for (const w of list) {
    const key = `${kindOf(w)}:${w.showId}`
    const eps = Object.entries(monthBuckets(w)).reduce((s, [m, n]) => s + (inYear(m) ? n : 0), 0)
    const avg = averageRating(w)
    const prev = byShow.get(key)
    if (!prev) byShow.set(key, { w, avg, eps })
    else {
      // The same show logged twice (two seasons, two households): keep its best score, add up the episodes
      const better = (avg ?? -1) > (prev.avg ?? -1)
      byShow.set(key, { w: better ? w : prev.w, avg: better ? avg : prev.avg, eps: prev.eps + eps })
    }
  }
  const top = [...byShow.values()]
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.eps - a.eps || a.w.showName.localeCompare(b.w.showName))
    .slice(0, 3)
    .map(({ w, avg }) => ({ name: w.showName, poster: bigPoster(w.poster), avg }))

  const ep = episodeOfYear(episodeReactions, watches, r.people.map((p) => p.id), year)
  // Same album rule as the slides: photos on these logs, one per night
  const logIds = new Set(watches.map((w) => w.id))
  const nights = new Map<string, CouchPhoto>()
  for (const p of [...photos].sort((a, b) => b.night.localeCompare(a.night))) {
    if (logIds.has(p.watchId) && p.night.startsWith(`${year}-`) && !nights.has(p.night) && p.url) nights.set(p.night, p)
  }
  return {
    year,
    soFar: !!opts.soFar,
    names: names(people, r.people.map((p) => p.id)) || t('The family'),
    totals: { episodes: r.episodes, hours: r.hours, series: r.series, movies: r.movies, days: r.days },
    top,
    episode: ep
      ? {
          show: ep.watch.showName,
          poster: bigPoster(ep.watch.poster),
          label: t('S{season} · E{n}', { season: ep.watch.season, n: ep.tally.episode }),
          emojis: Object.keys(ep.tally.byEmoji).slice(0, 4).join(' '),
          reactions: ep.tally.count,
        }
      : null,
    photos: [...nights.values()].slice(0, 3).map((p) => p.url),
    nights: nights.size,
  }
}

// ---- The timeline ----

interface SceneBase {
  /** Position in the video and how long it lasts (ms, already scaled by speed) */
  start: number
  ms: number
  index: number
  count: number
}
export type Scene = SceneBase &
  (
    | { kind: 'title'; kicker: string; year: string; title: string; sub: string }
    | { kind: 'totals'; kicker: string; stats: { value: string; label: string }[]; sub: string }
    | { kind: 'top'; kicker: string; shows: { rank: number; name: string; poster: string | null; score: string | null }[] }
    | { kind: 'episode'; kicker: string; show: string; poster: string | null; label: string; emojis: string }
    | { kind: 'photos'; kicker: string; photos: string[]; sub: string }
    | { kind: 'outro'; kicker: string; title: string; sub: string; logo: string }
  )

/** Cuts long names so they fit on the frame ("The Marvelous Mrs. Maisel and…" → "The Marvelous Mrs. Mais…"). */
export function clip(text: string, max: number): string {
  const chars = Array.from(text.trim())
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('').trimEnd()}…`
}

/** Every image the video may draw (posters and photos), so they can be loaded up front. */
export function sceneImages(scenes: Scene[]): string[] {
  const urls = new Set<string>()
  for (const s of scenes) {
    if (s.kind === 'top') s.shows.forEach((x) => x.poster && urls.add(x.poster))
    if (s.kind === 'episode' && s.poster) urls.add(s.poster)
    if (s.kind === 'photos') s.photos.forEach((p) => urls.add(p))
    if (s.kind === 'outro') urls.add(s.logo)
  }
  return [...urls]
}

type Draft = Scene extends infer S ? (S extends Scene ? Omit<S, keyof SceneBase> & { base: number } : never) : never

/** The plan: which scenes, their text (in the app's language) and timing. `speed` 10 = ten times shorter. */
export function videoScenes(d: VideoData, opts: { speed?: number } = {}): Scene[] {
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1
  const { series, movies, episodes, hours, days } = d.totals
  const drafts: Draft[] = [
    {
      kind: 'title',
      base: 3000,
      kicker: 'Pititi Wrapped',
      year: String(d.year),
      title: t('Our {year} on the couch', { year: d.year }),
      sub: clip(d.soFar ? `${d.names} · ${t('so far')}` : d.names, 44),
    },
    {
      kind: 'totals',
      base: 3800,
      kicker: t('Together you watched'),
      stats: [
        { value: String(episodes), label: t('episodes') },
        { value: String(hours), label: t('hours') },
        ...(series > 0 || movies === 0 ? [{ value: String(series), label: series === 1 ? t('show') : t('shows') }] : []),
        ...(movies > 0 ? [{ value: String(movies), label: movies === 1 ? t('movie') : t('movies') }] : []),
      ],
      sub: days >= 1 ? (days === 1 ? t("That's a full day of TV. No regrets.") : t("That's {n} full days of TV. No regrets.", { n: days })) : '',
    },
  ]
  if (d.top.length)
    drafts.push({
      kind: 'top',
      base: d.top.length === 1 ? 3600 : 4600,
      kicker: d.top.length === 1 ? t('Show of the year') : t('Our top {n}', { n: d.top.length }),
      shows: d.top.map((s, i) => ({ rank: i + 1, name: clip(s.name, d.top.length === 1 ? 24 : 30), poster: s.poster, score: s.avg == null ? null : s.avg.toFixed(1) })),
    })
  if (d.episode)
    drafts.push({ kind: 'episode', base: 3400, kicker: t('Episode of the year'), show: clip(d.episode.show, 24), poster: d.episode.poster, label: d.episode.label, emojis: d.episode.emojis })
  if (d.photos.length)
    drafts.push({
      kind: 'photos',
      base: 3600,
      kicker: t('Nights on the couch'),
      photos: d.photos.slice(0, 3),
      sub: d.nights === 1 ? t('1 night saved in a photo.') : t('{n} nights saved in photos.', { n: d.nights }),
    })
  drafts.push({
    kind: 'outro',
    base: 2600,
    kicker: d.soFar ? t('More to come') : t('See you in {year}', { year: d.year + 1 }),
    title: t('Made with Pititi'),
    sub: `Pititi Watchers · ${APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}`,
    // The app's own icon (same site, so it's safe to record); a drawn mark stands in if it doesn't load
    logo: './icon-512.png',
  })
  const sum = drafts.reduce((s, x) => s + x.base, 0)
  const factor = Math.min(MAX_STRETCH, Math.max(MIN_SQUEEZE, TARGET_MS / sum)) / speed
  let start = 0
  return drafts.map(({ base, ...rest }, index) => {
    const ms = Math.round(base * factor)
    const scene = { ...rest, start, ms, index, count: drafts.length } as Scene
    start += ms
    return scene
  })
}

export function totalMs(scenes: Scene[]): number {
  const last = scenes[scenes.length - 1]
  return last ? last.start + last.ms : 0
}

/** Which scene is on screen at `ms`, and how far into it. */
export function sceneAt(scenes: Scene[], ms: number): { scene: Scene; t: number } {
  const scene = scenes.find((s) => ms < s.start + s.ms) ?? scenes[scenes.length - 1]
  return { scene, t: Math.max(0, Math.min(ms - scene.start, scene.ms)) }
}

// ---- Drawing ----

/** A loaded poster or photo (an ImageBitmap in the app; any image or canvas works). */
export type VideoImage = CanvasImageSource & { width: number; height: number }

const FONT = '-apple-system, "SF Pro Display", BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif'
const BG = '#110c16'
const PINK = '#ff4d6d'
const ORANGE = '#ff8a3d'
const SOFT = 'rgba(255,255,255,0.68)'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)

function font(weight: number, px: number) {
  return `${weight} ${px}px ${FONT}`
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function grad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, PINK)
  g.addColorStop(1, ORANGE)
  return g
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

/** Splits a headline into at most `lines` lines that fit `max` wide. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines = 2): string[] {
  const words = text.split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= max || !line) line = next
    else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  if (out.length <= lines) return out
  return [...out.slice(0, lines - 1), fit(ctx, out.slice(lines - 1).join(' '), max)]
}

/** Draws text centered at x with the given alpha and slide-up offset. */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, style: { font: string; fill: string | CanvasGradient; align?: CanvasTextAlign; spacing?: number }) {
  ctx.font = style.font
  ctx.fillStyle = style.fill
  ctx.textAlign = style.align ?? 'center'
  if (style.spacing && 'letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${style.spacing}px`
  ctx.fillText(s, x, y)
  if (style.spacing && 'letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
}

/** An element arriving: fades in and slides up 48px, `delay` ms into the scene. */
function arrive(ctx: CanvasRenderingContext2D, t: number, delay: number, draw: () => void, dur = 600) {
  const e = easeOut((t - delay) / dur)
  if (e <= 0) return
  ctx.save()
  ctx.globalAlpha *= e
  ctx.translate(0, (1 - e) * 48)
  draw()
  ctx.restore()
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => Array.from(p)[0] ?? '')
    .join('')
    .toUpperCase()
}

/** A poster or photo, cropped to fill the box with rounded corners. Missing images get a branded tile. */
function picture(ctx: CanvasRenderingContext2D, img: VideoImage | undefined, x: number, y: number, w: number, h: number, r: number, name = '') {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 18
  ctx.fillStyle = '#2a2230'
  rounded(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
  ctx.save()
  rounded(ctx, x, y, w, h, r)
  ctx.clip()
  if (img && img.width && img.height) {
    const s = Math.max(w / img.width, h / img.height)
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s)
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, '#5b2a86')
    g.addColorStop(1, PINK)
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
    if (name) text(ctx, initials(name), x + w / 2, y + h / 2 + w * 0.1, { font: font(800, Math.round(w * 0.28)), fill: 'rgba(255,255,255,0.92)' })
  }
  ctx.restore()
}

function background(ctx: CanvasRenderingContext2D, ms: number) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  // Two warm glows drifting slowly: the brand gradient, kept dark so text stays readable
  const drift = ms / 1000
  const glow = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(17,12,22,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  }
  glow(160 + Math.sin(drift * 0.5) * 80, 260 + Math.cos(drift * 0.4) * 60, 900, 'rgba(255,77,109,0.42)')
  glow(940 + Math.cos(drift * 0.45) * 80, 1700 + Math.sin(drift * 0.35) * 70, 950, 'rgba(255,138,61,0.34)')
}

function progress(ctx: CanvasRenderingContext2D, scene: Scene, t: number) {
  const gap = 10
  const x0 = 64
  const w = (VIDEO_W - x0 * 2 - gap * (scene.count - 1)) / scene.count
  for (let i = 0; i < scene.count; i++) {
    const x = x0 + i * (w + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    rounded(ctx, x, 70, w, 8, 4)
    ctx.fill()
    const done = i < scene.index ? 1 : i === scene.index ? clamp01(t / scene.ms) : 0
    if (done > 0) {
      ctx.fillStyle = '#fff'
      rounded(ctx, x, 70, Math.max(8, w * done), 8, 4)
      ctx.fill()
    }
  }
}

function kicker(ctx: CanvasRenderingContext2D, s: string, y: number) {
  text(ctx, s.toUpperCase(), VIDEO_W / 2, y, { font: font(800, 40), fill: grad(ctx, 240, 0, 840, 0), spacing: 6 })
}

function drawTitle(ctx: CanvasRenderingContext2D, s: Extract<Scene, { kind: 'title' }>, t: number) {
  arrive(ctx, t, 100, () => kicker(ctx, s.kicker, 640))
  arrive(ctx, t, 250, () => text(ctx, s.year, VIDEO_W / 2, 940, { font: font(900, 300), fill: grad(ctx, 200, 700, 880, 960) }), 800)
  arrive(ctx, t, 600, () => {
    ctx.font = font(800, 84)
    wrap(ctx, s.title, VIDEO_W - 180).forEach((line, i) => text(ctx, line, VIDEO_W / 2, 1110 + i * 100, { font: font(800, 84), fill: '#fff' }))
  })
  arrive(ctx, t, 900, () => {
    ctx.font = font(600, 44)
    text(ctx, fit(ctx, s.sub, VIDEO_W - 200), VIDEO_W / 2, 1360, { font: font(600, 44), fill: SOFT })
  })
}

function drawTotals(ctx: CanvasRenderingContext2D, s: Extract<Scene, { kind: 'totals' }>, t: number) {
  arrive(ctx, t, 50, () => kicker(ctx, s.kicker, 420))
  const cw = 440
  const ch = 380
  const gap = 40
  const x0 = (VIDEO_W - cw * 2 - gap) / 2
  s.stats.forEach((stat, i) => {
    // Three stats: two on top, the last one centred below
    const lone = s.stats.length % 2 === 1 && i === s.stats.length - 1
    const x = lone ? (VIDEO_W - cw) / 2 : x0 + (i % 2) * (cw + gap)
    const y = 520 + Math.floor(i / 2) * (ch + gap)
    arrive(ctx, t, 200 + i * 160, () => {
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      rounded(ctx, x, y, cw, ch, 48)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.font = font(900, 168)
      const size = ctx.measureText(stat.value).width > cw - 60 ? Math.floor(168 * ((cw - 60) / ctx.measureText(stat.value).width)) : 168
      text(ctx, stat.value, x + cw / 2, y + 220, { font: font(900, size), fill: grad(ctx, x + 60, y, x + cw - 60, y + ch) })
      ctx.font = font(700, 46)
      text(ctx, fit(ctx, stat.label, cw - 60), x + cw / 2, y + 305, { font: font(700, 46), fill: '#fff' })
    })
  })
  if (s.sub)
    arrive(ctx, t, 900, () => {
      ctx.font = font(600, 44)
      wrap(ctx, s.sub, VIDEO_W - 200).forEach((line, i) => text(ctx, line, VIDEO_W / 2, 1460 + i * 60, { font: font(600, 44), fill: SOFT }))
    })
}

function drawTop(ctx: CanvasRenderingContext2D, s: Extract<Scene, { kind: 'top' }>, t: number, images: Map<string, VideoImage>) {
  arrive(ctx, t, 50, () => kicker(ctx, s.kicker, 300))
  if (s.shows.length === 1) {
    const show = s.shows[0]
    const w = 600
    const h = 900
    arrive(ctx, t, 200, () => picture(ctx, show.poster ? images.get(show.poster) : undefined, (VIDEO_W - w) / 2, 400, w, h, 44, show.name), 800)
    arrive(ctx, t, 600, () => {
      ctx.font = font(800, 80)
      text(ctx, fit(ctx, show.name, VIDEO_W - 160), VIDEO_W / 2, 1430, { font: font(800, 80), fill: '#fff' })
      if (show.score) text(ctx, `★ ${show.score}`, VIDEO_W / 2, 1530, { font: font(800, 60), fill: '#f5a524' })
    })
    return
  }
  const pw = 250
  const ph = 375
  const rowH = 440
  const y0 = 400 + ((3 - s.shows.length) * rowH) / 2
  s.shows.forEach((show, i) => {
    const y = y0 + i * rowH
    arrive(ctx, t, 220 + i * 260, () => {
      picture(ctx, show.poster ? images.get(show.poster) : undefined, 220, y, pw, ph, 30, show.name)
      text(ctx, String(show.rank), 120, y + ph / 2 + 50, { font: font(900, 150), fill: grad(ctx, 60, y, 180, y + ph) })
      const tx = 220 + pw + 56
      ctx.font = font(800, 60)
      const lines = wrap(ctx, show.name, VIDEO_W - tx - 70)
      const top = y + ph / 2 - (lines.length - 1) * 36 - (show.score ? 20 : -20)
      lines.forEach((line, n) => text(ctx, line, tx, top + n * 72, { font: font(800, 60), fill: '#fff', align: 'left' }))
      if (show.score) text(ctx, `★ ${show.score}`, tx, top + lines.length * 72 + 14, { font: font(800, 48), fill: '#f5a524', align: 'left' })
    })
  })
}

function drawEpisode(ctx: CanvasRenderingContext2D, s: Extract<Scene, { kind: 'episode' }>, t: number, images: Map<string, VideoImage>) {
  arrive(ctx, t, 50, () => kicker(ctx, s.kicker, 340))
  const w = 520
  const h = 780
  arrive(ctx, t, 200, () => picture(ctx, s.poster ? images.get(s.poster) : undefined, (VIDEO_W - w) / 2, 430, w, h, 40, s.show), 800)
  arrive(ctx, t, 550, () => {
    ctx.font = font(800, 80)
    text(ctx, fit(ctx, s.show, VIDEO_W - 160), VIDEO_W / 2, 1340, { font: font(800, 80), fill: '#fff' })
    text(ctx, s.label, VIDEO_W / 2, 1430, { font: font(800, 56), fill: grad(ctx, 380, 0, 700, 0) })
  })
  if (s.emojis) arrive(ctx, t, 850, () => text(ctx, s.emojis, VIDEO_W / 2, 1590, { font: font(400, 100), fill: '#fff' }))
}

function drawPhotos(ctx: CanvasRenderingContext2D, s: Extract<Scene, { kind: 'photos' }>, t: number, images: Map<string, VideoImage>) {
  arrive(ctx, t, 50, () => kicker(ctx, s.kicker, 300))
  // Polaroids, slightly turned, dropped one after another
  const shown = s.photos.filter((p) => images.has(p))
  const n = shown.length
  const layouts: Record<number, { x: number; y: number; w: number; h: number; a: number }[]> = {
    1: [{ x: 540, y: 900, w: 760, h: 900, a: -2 }],
    2: [
      { x: 420, y: 760, w: 560, h: 640, a: -6 },
      { x: 660, y: 1120, w: 560, h: 640, a: 5 },
    ],
    3: [
      { x: 370, y: 660, w: 480, h: 560, a: -7 },
      { x: 710, y: 860, w: 480, h: 560, a: 6 },
      { x: 480, y: 1200, w: 480, h: 560, a: -3 },
    ],
  }
  ;(layouts[n] ?? []).forEach((l, i) => {
    arrive(ctx, t, 200 + i * 300, () => {
      ctx.save()
      ctx.translate(l.x, l.y)
      ctx.rotate((l.a * Math.PI) / 180)
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 50
      ctx.shadowOffsetY = 20
      ctx.fillStyle = '#fbf8f4'
      rounded(ctx, -l.w / 2, -l.h / 2, l.w, l.h, 18)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      const pad = 24
      const img = images.get(shown[i])!
      ctx.save()
      rounded(ctx, -l.w / 2 + pad, -l.h / 2 + pad, l.w - pad * 2, l.h - pad * 2 - 70, 8)
      ctx.clip()
      const bw = l.w - pad * 2
      const bh = l.h - pad * 2 - 70
      const k = Math.max(bw / img.width, bh / img.height)
      ctx.drawImage(img, -l.w / 2 + pad + (bw - img.width * k) / 2, -l.h / 2 + pad + (bh - img.height * k) / 2, img.width * k, img.height * k)
      ctx.restore()
      ctx.restore()
    }, 700)
  })
  arrive(ctx, t, 300 + n * 300, () => {
    ctx.font = font(600, 46)
    text(ctx, fit(ctx, s.sub, VIDEO_W - 200), VIDEO_W / 2, 1640, { font: font(600, 46), fill: SOFT })
  })
}

function logo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, img?: VideoImage) {
  if (img) {
    ctx.save()
    ctx.shadowColor = 'rgba(255,77,109,0.55)'
    ctx.shadowBlur = 60
    rounded(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.46)
    ctx.fillStyle = PINK
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.clip()
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.shadowColor = 'rgba(255,77,109,0.55)'
  ctx.shadowBlur = 60
  ctx.fillStyle = grad(ctx, cx - r, cy - r, cx + r, cy + r)
  rounded(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.46)
  ctx.fill()
  ctx.restore()
  // A play triangle, the app's "watch" mark
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.28, cy - r * 0.42)
  ctx.lineTo(cx + r * 0.46, cy)
  ctx.lineTo(cx - r * 0.28, cy + r * 0.42)
  ctx.closePath()
  ctx.fill()
}

function drawOutro(ctx: CanvasRenderingContext2D, s: Extract<Scene, { kind: 'outro' }>, t: number, images: Map<string, VideoImage>) {
  arrive(ctx, t, 50, () => logo(ctx, VIDEO_W / 2, 740, 120, images.get(s.logo)), 700)
  arrive(ctx, t, 300, () => {
    ctx.font = font(900, 104)
    wrap(ctx, s.title, VIDEO_W - 160).forEach((line, i) => text(ctx, line, VIDEO_W / 2, 1010 + i * 116, { font: font(900, 104), fill: '#fff' }))
  })
  arrive(ctx, t, 550, () => kicker(ctx, s.kicker, 1170))
  arrive(ctx, t, 800, () => {
    ctx.font = font(600, 38)
    text(ctx, fit(ctx, s.sub, VIDEO_W - 160), VIDEO_W / 2, 1290, { font: font(600, 38), fill: SOFT })
  })
}

/**
 * Draws one whole frame: background, progress, the scene's content `t` ms into it.
 * Scenes fade in from and out to the background, so cuts never jump.
 */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, t: number, images: Map<string, VideoImage>) {
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  background(ctx, scene.start + t)
  progress(ctx, scene, t)
  const last = scene.index === scene.count - 1
  const fadeOut = last ? 1 : clamp01((scene.ms - t) / Math.min(350, scene.ms / 4))
  ctx.globalAlpha = fadeOut
  if (scene.kind === 'title') drawTitle(ctx, scene, t)
  else if (scene.kind === 'totals') drawTotals(ctx, scene, t)
  else if (scene.kind === 'top') drawTop(ctx, scene, t, images)
  else if (scene.kind === 'episode') drawEpisode(ctx, scene, t, images)
  else if (scene.kind === 'photos') drawPhotos(ctx, scene, t, images)
  else drawOutro(ctx, scene, t, images)
  if (!last) text(ctx, 'Pititi Watchers', VIDEO_W / 2, VIDEO_H - 90, { font: font(700, 34), fill: 'rgba(255,255,255,0.5)' })
  ctx.restore()
}

/** The frame at `ms` into the video. Short tests run the same code at `speed`, so delays are scaled too. */
export function drawFrame(ctx: CanvasRenderingContext2D, scenes: Scene[], ms: number, images: Map<string, VideoImage>, speed = 1) {
  const { scene, t } = sceneAt(scenes, ms)
  drawScene(ctx, { ...scene, ms: scene.ms * speed, start: scene.start * speed }, t * speed, images)
}
