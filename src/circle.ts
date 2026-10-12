// The family circle: households, lists (with privacy and votes), recommendations and chat mutes.
// Kept out of App so the main screen logic stays readable. Every change is optimistic with Undo.
import { useCallback, useRef, useState } from 'react'
import { newId } from './logic'
import type { Snapshot, Store } from './store/store'
import type { Household, ListItem, Person, Recommendation, Title, WatchList } from './types'

type Flash = (msg: string, undo?: () => void, label?: string) => void

export interface Circle {
  households: Household[]
  lists: WatchList[]
  items: ListItem[]
  recs: Recommendation[]
  mutes: string[]
  /** Fill from a fresh load */
  take: (snap: Snapshot) => void
  /** Your household's Up Next (created the first time it's needed) */
  defaultList: () => Promise<WatchList | null>
  addToList: (t: Title, listId?: string, quiet?: boolean) => Promise<ListItem | null>
  removeItem: (item: ListItem, quiet?: boolean) => Promise<void>
  vote: (item: ListItem) => Promise<void>
  saveList: (l: WatchList, msg?: string) => Promise<boolean>
  deleteList: (l: WatchList) => Promise<void>
  recommend: (t: Title, to: string[], note: string) => Promise<boolean>
  answer: (r: Recommendation, status: 'added' | 'dismissed') => Promise<void>
  mute: (thread: string, muted: boolean) => Promise<void>
}

export function useCircle(store: Store, me: Person | undefined, flash: Flash): Circle {
  const [households, setHouseholds] = useState<Household[]>([])
  const [lists, setLists] = useState<WatchList[]>([])
  const [items, setItems] = useState<ListItem[]>([])
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [mutes, setMutes] = useState<string[]>([])
  // Undo and async steps run later than the render that created them
  const live = useRef({ lists, items, me })
  live.current = { lists, items, me }

  const take = useCallback((snap: Snapshot) => {
    setHouseholds(snap.households ?? [])
    setLists(snap.lists ?? [])
    setItems(snap.listItems ?? [])
    setRecs(snap.recommendations ?? [])
    setMutes(snap.mutes ?? [])
  }, [])

  const mineHousehold = () => live.current.me?.householdId ?? ''

  async function saveList(l: WatchList, msg?: string): Promise<boolean> {
    const before = live.current.lists.find((x) => x.id === l.id) ?? null
    setLists((all) => [...all.filter((x) => x.id !== l.id), l])
    try {
      await store.saveList(l)
      if (msg) flash(msg, before ? () => saveList(before) : undefined)
      return true
    } catch (e) {
      setLists((all) => (before ? all.map((x) => (x.id === l.id ? before : x)) : all.filter((x) => x.id !== l.id)))
      flash((e as Error).message || "Couldn't save the list. Check your connection.")
      return false
    }
  }

  async function defaultList(): Promise<WatchList | null> {
    const home = mineHousehold()
    const found = live.current.lists.find((l) => l.isDefault && (!home || l.householdId === home || !l.householdId))
    if (found) return found
    const up: WatchList = {
      id: newId(),
      householdId: home,
      name: 'Up Next',
      emoji: '📌',
      visibility: 'household',
      sharedWith: [],
      askVotes: false,
      isDefault: true,
      createdBy: live.current.me?.id ?? null,
      createdAt: new Date().toISOString(),
    }
    return (await saveList(up)) ? up : null
  }

  async function addToList(t: Title, listId?: string, quiet = false): Promise<ListItem | null> {
    const list = listId ? live.current.lists.find((l) => l.id === listId) : await defaultList()
    if (!list) return null
    if (live.current.items.some((i) => i.listId === list.id && i.kind === t.kind && i.extId === t.extId)) {
      if (!quiet) flash(`${t.title} is already on ${list.name}`)
      return null
    }
    const item: ListItem = {
      ...t,
      id: newId(),
      listId: list.id,
      addedBy: live.current.me?.id ?? null,
      // Saving a title counts as wanting it
      votes: live.current.me ? [live.current.me.id] : [],
      createdAt: new Date().toISOString(),
    }
    setItems((all) => [...all, item])
    try {
      await store.addItem(item)
      if (!quiet) flash(`${t.title} saved to ${list.emoji} ${list.name}`, () => removeItem(item, true))
      return item
    } catch (e) {
      setItems((all) => all.filter((x) => x.id !== item.id))
      flash((e as Error).message || "Couldn't save it. Check your connection.")
      return null
    }
  }

  async function removeItem(item: ListItem, quiet = false) {
    setItems((all) => all.filter((x) => x.id !== item.id))
    try {
      await store.removeItem(item.id)
      const list = live.current.lists.find((l) => l.id === item.listId)
      if (!quiet) flash(`${item.title} removed from ${list?.name ?? 'the list'}`, () => restoreItem(item))
    } catch (e) {
      setItems((all) => [...all, item])
      flash((e as Error).message || "Couldn't remove it. Check your connection.")
    }
  }

  async function restoreItem(item: ListItem) {
    setItems((all) => [...all.filter((x) => x.id !== item.id), item])
    try {
      await store.addItem(item)
    } catch {
      setItems((all) => all.filter((x) => x.id !== item.id))
      flash("Couldn't put it back. Check your connection.")
    }
  }

  async function vote(item: ListItem) {
    const who = live.current.me?.id
    if (!who) return
    const flip = (i: ListItem) => ({ ...i, votes: i.votes.includes(who) ? i.votes.filter((v) => v !== who) : [...i.votes, who] })
    setItems((all) => all.map((x) => (x.id === item.id ? flip(x) : x)))
    try {
      const votes = await store.vote(item.id, who)
      setItems((all) => all.map((x) => (x.id === item.id ? { ...x, votes } : x)))
    } catch {
      setItems((all) => all.map((x) => (x.id === item.id ? item : x)))
      flash("Couldn't save your vote. Check your connection.")
    }
  }

  async function deleteList(l: WatchList) {
    const keep = live.current.items.filter((i) => i.listId === l.id)
    setLists((all) => all.filter((x) => x.id !== l.id))
    setItems((all) => all.filter((i) => i.listId !== l.id))
    try {
      await store.removeList(l.id)
      flash(`${l.name} removed`, async () => {
        if (await saveList(l)) for (const i of keep) await restoreItem(i)
      })
    } catch (e) {
      setLists((all) => [...all, l])
      setItems((all) => [...all, ...keep])
      flash((e as Error).message || "Couldn't remove the list. Check your connection.")
    }
  }

  async function recommend(t: Title, to: string[], note: string): Promise<boolean> {
    const from = live.current.me?.id
    if (!from || !to.length) return false
    const made: Recommendation[] = to.map((id) => ({ ...t, id: newId(), from, to: id, note, status: 'new', createdAt: new Date().toISOString() }))
    setRecs((all) => [...made, ...all])
    try {
      for (const r of made) await store.recommend(r)
      flash(to.length === 1 ? 'Recommendation sent' : `Sent to ${to.length} people`)
      return true
    } catch {
      setRecs((all) => all.filter((r) => !made.some((m) => m.id === r.id)))
      flash("Couldn't send it. Check your connection.")
      return false
    }
  }

  async function answer(r: Recommendation, status: 'added' | 'dismissed') {
    setRecs((all) => all.map((x) => (x.id === r.id ? { ...x, status } : x)))
    try {
      await store.answerRecommendation(r.id, status)
      if (status === 'added') await addToList(r, undefined, false)
      else
        flash('Got it. Not for you.', async () => {
          setRecs((all) => all.map((x) => (x.id === r.id ? { ...x, status: 'new' } : x)))
          await store.answerRecommendation(r.id, 'new').catch(() => undefined)
        })
    } catch {
      setRecs((all) => all.map((x) => (x.id === r.id ? r : x)))
      flash("Couldn't save that. Check your connection.")
    }
  }

  async function mute(thread: string, muted: boolean) {
    const who = live.current.me?.id
    if (!who) return
    setMutes((all) => (muted ? [...new Set([...all, thread])] : all.filter((t) => t !== thread)))
    try {
      await store.setMute(who, thread, muted)
      flash(muted ? 'Muted. You still hear @mentions.' : 'Notifications back on for this chat')
    } catch {
      setMutes((all) => (muted ? all.filter((t) => t !== thread) : [...all, thread]))
      flash("Couldn't change that. Check your connection.")
    }
  }

  return { households, lists, items, recs, mutes, take, defaultList, addToList, removeItem, vote, saveList, deleteList, recommend, answer, mute }
}
