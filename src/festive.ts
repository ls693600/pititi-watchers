// Festive looks for special days: colors, a greeting on Home, and a few emoji drifting by once a day.
// Pure date logic here (tested); App applies it with data-festive on <html>, CSS does the colors.

export type FestiveId = 'halloween' | 'christmas' | 'newyear' | 'valentines' | 'namorados' | 'stpatricks' | 'easter' | 'carnaval' | 'junina' | 'mothers'

export interface Festive {
  id: FestiveId
  /** English keys; translated where shown */
  name: string
  greeting: string
  emoji: string
  /** What drifts across the screen */
  particles: string[]
}

const FESTIVE: Record<FestiveId, Omit<Festive, 'id'>> = {
  halloween: { name: 'Halloween', greeting: 'Happy Halloween! Spooky picks tonight?', emoji: '🎃', particles: ['🦇', '🎃', '👻', '🕸️'] },
  christmas: { name: 'Christmas', greeting: 'Merry Christmas! Cozy movie night?', emoji: '🎄', particles: ['❄️', '⭐', '🎁', '❄️'] },
  newyear: { name: 'New Year', greeting: 'Happy New Year! What are we watching first?', emoji: '🎆', particles: ['🎆', '✨', '🥂', '🎉'] },
  valentines: { name: "Valentine's Day", greeting: "Happy Valentine's! Something romantic tonight?", emoji: '💕', particles: ['💕', '❤️', '💖', '🌹'] },
  namorados: { name: 'Dia dos Namorados', greeting: 'Happy Dia dos Namorados! Date night on the couch?', emoji: '💘', particles: ['💘', '❤️', '🌹', '💌'] },
  stpatricks: { name: "St. Patrick's Day", greeting: "Happy St. Patrick's Day! Feeling lucky?", emoji: '☘️', particles: ['☘️', '🍀', '🌈', '🪙'] },
  easter: { name: 'Easter', greeting: 'Happy Easter! Family movie time?', emoji: '🐣', particles: ['🥚', '🐣', '🐰', '🌷'] },
  carnaval: { name: 'Carnaval', greeting: 'Happy Carnaval! Samba, then a show?', emoji: '🎉', particles: ['🎉', '🎊', '🪇', '✨'] },
  junina: { name: 'Festa Junina', greeting: 'Arraiá time! Pamonha and a good show?', emoji: '🌽', particles: ['🌽', '🔥', '🎈', '⭐'] },
  mothers: { name: "Mother's Day", greeting: "Happy Mother's Day! Mom picks tonight.", emoji: '🌷', particles: ['🌷', '💐', '💗', '🌸'] },
}

/** Easter Sunday (Anonymous Gregorian algorithm), month 1–12. */
export function easter(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

/** Days between two calendar dates (local time, ignores the clock). */
function dayDiff(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ua - ub) / 86_400_000)
}

/** The nth Sunday of a month (n = 1, 2…). */
function nthSunday(year: number, month0: number, n: number): number {
  const first = new Date(year, month0, 1).getDay()
  return 1 + ((7 - first) % 7) + (n - 1) * 7
}

/** Which festive look applies on a date, if any. */
export function festiveFor(date: Date): Festive | null {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const pick = (id: FestiveId): Festive => ({ id, ...FESTIVE[id] })

  if ((m === 12 && d === 31) || (m === 1 && d === 1)) return pick('newyear')
  if (m === 12 && d >= 18 && d <= 26) return pick('christmas')
  if (m === 10 && d >= 25) return pick('halloween')
  if (m === 2 && d === 14) return pick('valentines')
  if (m === 3 && d === 17) return pick('stpatricks')
  if (m === 6 && d === 12) return pick('namorados')
  if (m === 6 && d >= 13 && d <= 29) return pick('junina')
  if (m === 5 && d === nthSunday(y, 4, 2)) return pick('mothers')

  const e = easter(y)
  const sunday = new Date(y, e.month - 1, e.day)
  const diff = dayDiff(date, sunday)
  // Good Friday to Easter Sunday
  if (diff >= -2 && diff <= 0) return pick('easter')
  // Carnaval: Saturday to Fat Tuesday (Easter − 50 … − 47)
  if (diff >= -50 && diff <= -47) return pick('carnaval')
  return null
}

export function festiveById(id: string): Festive | null {
  return id in FESTIVE ? { id: id as FestiveId, ...FESTIVE[id as FestiveId] } : null
}
