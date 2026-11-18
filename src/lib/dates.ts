// Dates as the family lives them: the phone's own calendar (never UTC, which is already "tomorrow" in the evening
// in the Americas), and an evening that runs past midnight (until 5 AM it's still the night before).

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The calendar date on this phone (YYYY-MM-DD), optionally some days later or earlier. */
export function localDay(now: Date | number = new Date(), addDays = 0): string {
  const d = new Date(now)
  if (addDays) d.setDate(d.getDate() + addDays)
  return ymd(d)
}

/** Tonight (YYYY-MM-DD): just after midnight still counts as the evening before. */
export function tonight(now: Date | number = new Date()): string {
  const d = new Date(now)
  if (d.getHours() < 5) d.setDate(d.getDate() - 1)
  return ymd(d)
}

/** The month what you watch now counts in (YYYY-MM): New Year's Eve at 00:30 is still December. */
export function watchMonth(now: Date | number = new Date()): string {
  return tonight(now).slice(0, 7)
}
