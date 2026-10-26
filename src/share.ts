// Share cards: a picture of what the family watched and how they rated it, sent through the phone's share sheet.
import { t } from './i18n'
import { bigPoster } from './tvmaze'

export const APP_URL = 'https://ls693600.github.io/pititi-watchers/'

const W = 1080
// 3:4 portrait: room for two rows of posters plus the footer
const H = 1500
const INK = '#1a1720'
const MUTED = '#8a8490'

export interface CardShow {
  name: string
  poster: string | null
  /** Family average or a person's score (1–10), null if not rated */
  stars: number | null
  note: string
}

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
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

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, r: number, name: string) {
  ctx.save()
  rounded(ctx, x, y, w, h, r)
  ctx.clip()
  if (img) {
    const s = Math.max(w / img.width, h / img.height)
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s)
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, '#5b6cff')
    g.addColorStop(1, '#9b5de5')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `800 ${Math.round(w / 4)}px -apple-system, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase(), x + w / 2, y + h / 2 + w / 10)
    ctx.textAlign = 'left'
  }
  ctx.restore()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

/** Ten stars filled to the exact value (8.5 shows eight and a half), like the app's 1–10 scale. */
function stars(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, size: number) {
  const px = Math.round(size * 0.62)
  ctx.font = `${px}px -apple-system, system-ui, sans-serif`
  const step = px * 1.04
  ctx.fillStyle = '#e2ddd6'
  for (let i = 0; i < 10; i++) ctx.fillText('★', x + i * step, y)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y - px, step * value, px * 1.4)
  ctx.clip()
  ctx.fillStyle = '#f5a524'
  for (let i = 0; i < 10; i++) ctx.fillText('★', x + i * step, y)
  ctx.restore()
}

function header(ctx: CanvasRenderingContext2D, kicker: string, title: string) {
  const g = ctx.createLinearGradient(0, 0, W, 420)
  g.addColorStop(0, '#ff4d6d')
  g.addColorStop(1, '#ff8a3d')
  ctx.fillStyle = '#f6f3ef'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = g
  rounded(ctx, 0, -60, W, 470, 60)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath()
  ctx.arc(W - 90, 40, 230, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '700 34px -apple-system, system-ui, sans-serif'
  ctx.fillText(kicker.toUpperCase(), 72, 110)
  ctx.font = '900 92px -apple-system, system-ui, sans-serif'
  ctx.fillText(fitText(ctx, title, W - 144), 72, 210)
}

function footer(ctx: CanvasRenderingContext2D, names: string) {
  ctx.fillStyle = INK
  ctx.font = '800 34px -apple-system, system-ui, sans-serif'
  ctx.fillText('Pititi Watchers', 72, H - 92)
  ctx.fillStyle = MUTED
  ctx.font = '500 26px -apple-system, system-ui, sans-serif'
  ctx.fillText(fitText(ctx, `${names} · ${APP_URL.replace('https://', '').replace(/\/$/, '')}`, W - 144), 72, H - 50)
}

/** "Our October": up to 6 posters with ratings and the month's totals. */
export async function drawMonthCard(opts: {
  monthName: string
  totals: { shows: number; episodes: number; hours: number }
  shows: CardShow[]
  names: string
}): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  header(ctx, t('What we watched'), t('Our {month}', { month: opts.monthName }))

  const pills = [
    [opts.totals.shows, opts.totals.shows === 1 ? t('show') : t('shows')],
    [opts.totals.episodes, t('episodes')],
    [`${opts.totals.hours}h`, t('watched')],
  ] as const
  pills.forEach(([n, label], i) => {
    const x = 72 + i * 316
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    rounded(ctx, x, 262, 292, 108, 26)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '900 48px -apple-system, system-ui, sans-serif'
    ctx.fillText(String(n), x + 26, 322)
    ctx.font = '600 24px -apple-system, system-ui, sans-serif'
    ctx.fillText(label, x + 26, 354)
  })

  const shown = opts.shows.slice(0, 6)
  const imgs = await Promise.all(shown.map((s) => loadImage(bigPoster(s.poster))))
  // Two rows of three: row 2 labels end around y=1350, the footer starts at H-92 (1408)
  const cw = 272
  const ch = 372
  const gap = (W - 144 - cw * 3) / 2
  shown.forEach((s, i) => {
    const x = 72 + (i % 3) * (cw + gap)
    const y = 430 + Math.floor(i / 3) * (ch + 100)
    ctx.save()
    ctx.shadowColor = 'rgba(26,23,32,0.18)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 12
    ctx.fillStyle = '#fff'
    rounded(ctx, x, y, cw, ch, 26)
    ctx.fill()
    ctx.restore()
    cover(ctx, imgs[i], x, y, cw, ch, 26, s.name)
    ctx.fillStyle = INK
    ctx.font = '700 28px -apple-system, system-ui, sans-serif'
    ctx.fillText(fitText(ctx, s.name, cw), x, y + ch + 38)
    if (s.stars != null) stars(ctx, s.stars, x, y + ch + 76, 30)
    else {
      ctx.fillStyle = MUTED
      ctx.font = '500 24px -apple-system, system-ui, sans-serif'
      ctx.fillText(fitText(ctx, s.note, cw), x, y + ch + 72)
    }
  })
  if (!shown.length) {
    ctx.fillStyle = MUTED
    ctx.font = '500 34px -apple-system, system-ui, sans-serif'
    ctx.fillText(t('Nothing logged yet this month.'), 72, 520)
  }
  footer(ctx, opts.names)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'))
}

/** One show: big poster and everyone's stars. */
export async function drawShowCard(opts: {
  name: string
  meta: string
  poster: string | null
  ratings: { name: string; stars: number | null; color: string }[]
  average: number | null
  /** "family average", or "Leandro's rating" for a solo watch */
  averageLabel?: string
  names: string
}): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  header(ctx, t('We watched'), opts.name)
  ctx.fillStyle = '#fff'
  ctx.font = '600 32px -apple-system, system-ui, sans-serif'
  ctx.fillText(fitText(ctx, opts.meta, W - 144), 72, 270)

  const img = await loadImage(bigPoster(opts.poster))
  // Poster on the left, scores on the right, both clear of the header (ends ~410)
  const pw = 460
  const ph = 690
  const py = 470
  ctx.save()
  ctx.shadowColor = 'rgba(26,23,32,0.25)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  ctx.fillStyle = '#fff'
  rounded(ctx, 72, py, pw, ph, 32)
  ctx.fill()
  ctx.restore()
  cover(ctx, img, 72, py, pw, ph, 32, opts.name)

  const x = 580
  let y = py + 40
  if (opts.average != null) {
    ctx.fillStyle = INK
    ctx.font = '900 150px -apple-system, system-ui, sans-serif'
    ctx.fillText(opts.average.toFixed(1), x - 6, y + 110)
    ctx.fillStyle = MUTED
    ctx.font = '600 30px -apple-system, system-ui, sans-serif'
    ctx.fillText(opts.averageLabel ?? t('family average'), x, y + 160)
    y += 260
  }
  opts.ratings.forEach((r) => {
    ctx.fillStyle = r.color
    ctx.beginPath()
    ctx.arc(x + 26, y - 12, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '800 28px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(r.name[0].toUpperCase(), x + 26, y - 2)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = '700 32px -apple-system, system-ui, sans-serif'
    ctx.fillText(fitText(ctx, r.name, 360), x + 70, y - 2)
    if (r.stars != null) stars(ctx, r.stars, x + 70, y + 48, 40)
    else {
      ctx.fillStyle = MUTED
      ctx.font = '500 26px -apple-system, system-ui, sans-serif'
      ctx.fillText(t('Not rated yet'), x + 70, y + 42)
    }
    y += 120
  })
  footer(ctx, opts.names)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'))
}

/** Opens the phone's share sheet with the picture (falls back to saving it). Returns how it went. */
export async function shareImage(blob: Blob, fileName: string, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' })
  const data = { files: [file], text: `${text}\n${APP_URL}` }
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'saved'
}
