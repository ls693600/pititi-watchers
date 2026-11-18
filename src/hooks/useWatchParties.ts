import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { newId } from '../logic'
import type { Parties, Store } from '../store/store'
import type { PartyAnswer, PartyMessage, WatchParty } from '../types'
import type { PartyAction } from '../watchParty'
import type { Flash } from './useToast'

const EMPTY: Parties = { parties: [], answers: [], messages: [], on: false }

/** What the server says when a party action isn't allowed, in the family's words */
function why(e: unknown): string {
  const code = String((e as Error)?.message ?? '')
  if (/join_first/.test(code)) return t('Say Join first.')
  if (/host_only/.test(code)) return t('Only the household that planned it can end it.')
  if (/party_over/.test(code)) return t('This party is over.')
  if (/already_started|not_playing|not_paused/.test(code)) return t('Someone just did that. Here is where the party is now.')
  return t("Couldn't reach the party. Check your connection.")
}

/**
 * Watch parties: loaded and kept live on their own channel (a busy party chat never reloads the whole app),
 * plus the server's clock, so every phone counts 3-2-1 from the same moment.
 */
export function useWatchParties(store: Store, ready: boolean, me: string | null, household: string | null, flash: Flash) {
  const [data, setData] = useState<Parties>(EMPTY)
  /** server clock minus this phone's clock (ms) */
  const [offset, setOffset] = useState(0)
  /** The first load answered (or failed): until then "no invitations" isn't known yet */
  const [synced, setSynced] = useState(false)
  const alive = useRef(true)
  // Only the newest refresh lands (a slow older one never overwrites a newer one)
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const n = ++seq.current
    try {
      const next = await store.loadParties()
      if (alive.current && n === seq.current) setData(next)
    } catch {
      // Offline: keep what's on screen
    }
    if (alive.current && n === seq.current) setSynced(true)
  }, [store])

  useEffect(() => {
    alive.current = true
    if (!ready) return
    refresh()
    const off = store.subscribeParties(refresh)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      off()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ready, store, refresh])

  /** Ask the server for its clock (when a party room opens) */
  const syncClock = useCallback(async () => {
    try {
      const sent = Date.now()
      const server = await store.serverNow()
      const back = Date.now()
      setOffset(server - (sent + back) / 2)
    } catch {
      // Keep the last known offset
    }
  }, [store])

  async function create(p: Omit<WatchParty, 'id' | 'createdBy' | 'state' | 'playAt' | 'positionSec' | 'pausedBy' | 'updatedAt' | 'createdAt' | 'hostHouseholdId'>): Promise<WatchParty | null> {
    if (!me || !household) return null
    const now = new Date().toISOString()
    const party: WatchParty = { ...p, id: newId(), hostHouseholdId: household, createdBy: me, state: 'planned', playAt: null, positionSec: 0, pausedBy: null, updatedAt: now, createdAt: now }
    setData((d) => ({ ...d, parties: [...d.parties, party], answers: [...d.answers, { partyId: party.id, personId: me, answer: 'join' }] }))
    try {
      await store.createParty(party)
      flash(t('Invitations sent 🎉'))
      refresh()
      return party
    } catch {
      setData((d) => ({ ...d, parties: d.parties.filter((x) => x.id !== party.id), answers: d.answers.filter((a) => a.partyId !== party.id) }))
      flash(t("Couldn't plan the party. Check your connection."))
      return null
    }
  }

  async function answer(partyId: string, value: PartyAnswer['answer']) {
    if (!me) return
    const a: PartyAnswer = { partyId, personId: me, answer: value }
    const same = (x: PartyAnswer) => x.partyId === partyId && x.personId === me
    const before = data.answers.find(same)
    setData((d) => ({ ...d, answers: [...d.answers.filter((x) => !same(x)), a] }))
    try {
      await store.answerParty(a)
    } catch {
      setData((d) => ({ ...d, answers: [...d.answers.filter((x) => !same(x)), ...(before ? [before] : [])] }))
      flash(t("Couldn't save your answer. Check your connection."))
    }
  }

  async function control(party: WatchParty, action: PartyAction, atSec: number | null = null): Promise<boolean> {
    if (!me) return false
    try {
      const sent = Date.now()
      const { party: next, serverNow } = await store.partyControl(party.id, action, atSec, { me, household })
      setOffset(serverNow - (sent + Date.now()) / 2)
      if (next) setData((d) => ({ ...d, parties: d.parties.map((x) => (x.id === next.id ? { ...next, guests: x.guests } : x)) }))
      return true
    } catch (e) {
      flash(why(e))
      refresh()
      return false
    }
  }

  async function send(partyId: string, kind: PartyMessage['kind'], body: string, atSec: number | null) {
    if (!me || !body.trim()) return
    const m: PartyMessage = { id: newId(), partyId, personId: me, kind, body: body.trim(), atSec, createdAt: new Date().toISOString() }
    setData((d) => ({ ...d, messages: [...d.messages, m] }))
    try {
      await store.sendPartyMessage(m)
    } catch {
      setData((d) => ({ ...d, messages: d.messages.filter((x) => x.id !== m.id) }))
      flash(t("Couldn't send it. Check your connection."))
    }
  }

  return { ...data, synced, offset, syncClock, refresh, create, answer, control, send }
}
