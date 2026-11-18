// What a save actually changed, so a phone with an older copy of a log never overwrites what someone else changed
// meanwhile (their rating, the episodes they marked, the notes) with its old values.

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** The columns that differ between the copy the change started from and the new one. */
export function changedColumns<T extends object>(before: T, next: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (!same(before[key], next[key])) out[key] = next[key]
  }
  return out
}

/** Ratings to write (new or changed) and to clear (removed by this change); everyone else's stay as they are. */
export function ratingChanges(before: Record<string, number> | null, next: Record<string, number>): { put: [string, number][]; clear: string[] } {
  const old = before ?? {}
  return {
    put: Object.entries(next).filter(([id, score]) => old[id] !== score),
    clear: before ? Object.keys(old).filter((id) => next[id] == null) : [],
  }
}

/** The log was removed (or isn't yours) by the time this change arrived: nothing to save. */
export class LogGone extends Error {
  constructor() {
    super('log_gone')
    this.name = 'LogGone'
  }
}
export const isLogGone = (e: unknown) => e instanceof LogGone || (e as { message?: string })?.message === 'log_gone'
