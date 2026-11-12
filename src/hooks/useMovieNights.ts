import { useCallback, useState } from 'react'
import { t } from '../i18n'
import { newId } from '../logic'
import { titleRef } from '../movieNight'
import type { Snapshot, Store } from '../store/store'
import type { MovieNight, NightTitle, NightVote } from '../types'
import type { Flash } from './useToast'

/** "Decide together": nights and votes, starting one and swiping. */
export function useMovieNights(store: Store, me: string | null, household: string | null, flash: Flash) {
  const [nights, setNights] = useState<MovieNight[]>([])
  const [votes, setVotes] = useState<NightVote[]>([])
  /** Needs migration 018; hidden until it's run */
  const [nightOn, setNightOn] = useState(false)

  const take = useCallback((snap: Partial<Pick<Snapshot, 'nights' | 'nightVotes' | 'nightOn'>>) => {
    if (snap.nights) setNights(snap.nights)
    if (snap.nightVotes) setVotes(snap.nightVotes)
    if (snap.nightOn !== undefined) setNightOn(snap.nightOn)
  }, [])

  async function start(titles: NightTitle[]): Promise<MovieNight | null> {
    if (!me) return null
    const night: MovieNight = { id: newId(), householdId: household, createdBy: me, titles, createdAt: new Date().toISOString() }
    setNights((list) => [...list, night])
    try {
      await store.startNight(night)
      return night
    } catch {
      setNights((list) => list.filter((n) => n.id !== night.id))
      flash(t("Couldn't start it. Check your connection."))
      return null
    }
  }

  async function vote(night: MovieNight, title: NightTitle, yes: boolean) {
    if (!me) return
    const v: NightVote = { nightId: night.id, personId: me, ref: titleRef(title), yes, createdAt: new Date().toISOString() }
    const same = (x: NightVote) => x.nightId === v.nightId && x.personId === v.personId && x.ref === v.ref
    setVotes((list) => [...list.filter((x) => !same(x)), v])
    try {
      await store.voteNight(v)
    } catch {
      setVotes((list) => list.filter((x) => !same(x)))
      flash(t("Couldn't save your swipe. Check your connection."))
    }
  }

  return { nights, votes, nightOn, take, start, vote }
}
