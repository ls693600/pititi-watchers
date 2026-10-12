import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, averageRating, chatLocked, mentionsIn, threadKey, totalUnread, defaultWatchersFor, finishSeason, joinWatchers, mergeLogs, familyBadges, inProgressFor, newlyEarned, reconcileMonths, setOwnRating, toggleReaction, canDelete, householdWatches, householdMembers, householdLabel, movieWatch, currentMonth, monthLabel, newId, pendingReveals, unseenComments } from './logic'
import { QuickActions } from './components/QuickActions'
import { UpdateBanner } from './components/UpdateBanner'
import { QuickLog } from './components/QuickLog'
import { Reveal } from './components/Reveal'
import { Detail } from './screens/Detail'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Search } from './screens/Search'
import { Settings } from './screens/Settings'
import { Help } from './screens/Help'
import { Messages } from './screens/Messages'
import { disablePush, enablePush, pushState, type PushState } from './push'
import { Stats } from './screens/Stats'
import { Lists, ListEditor } from './screens/Lists'
import { Family } from './screens/Family'
import { TitleSheet } from './components/TitleSheet'
import { MovieLog } from './components/MovieLog'
import { useCircle } from './circle'
import { t, useLang } from './i18n'
import { useFestive } from './useFestive'
import { FestiveRain } from './components/Festive'
import { cloudStore, currentSession, getInviteCode, getViewerCode, joinOptions, renewInviteCode, signIn, signOut, signUp } from './store/cloud'
import { cache, localStore } from './store/local'
import type { Session } from './store/store'
import type { Comment, ListItem, Person, Reaction, Title, Watch, WatchList } from './types'

const store = CLOUD_ENABLED ? cloudStore : localStore

type Tab = 'home' | 'lists' | 'search' | 'family' | 'stats' | 'members' | 'settings' | 'help'
// Settings lives behind your avatar (Home) and the gear on Family
const SIDE_TABS: { id: Tab; icon: IconName; label: string }[][] = [
  [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'lists', icon: 'list', label: 'Lists' },
  ],
  [
    { id: 'family', icon: 'users', label: 'Family' },
    { id: 'stats', icon: 'chart', label: 'Stats' },
  ],
]

/** Dev previews only: ?as=<personId> acts as that person in single-phone mode. Stripped from production builds. */
const DEV_VIEWER = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('as') : null

const SEEN_KEY = 'pititi.reveals.v1'
const BADGES_KEY = 'pititi.badges.v1'
/** Family chat lines and reactions this phone has already announced */
const CHAT_KEY = 'pititi.chatseen.v1'
const READ_KEY = 'pititi.chatread.v1'

function readSet(key: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // Not fatal: worst case a celebration shows again
  }
}

/** Logs whose reveal this phone has already shown. Null on first run. */
function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function writeSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // Not fatal: worst case a reveal shows again
  }
}

type Auth = { state: 'checking' } | { state: 'signedOut'; error?: string } | { state: 'ready'; session: Session | null }


function draftFrom(show: Title, month: string, watchedBy: string[], createdBy: string | null, householdId: string | null): Watch {
  const now = new Date().toISOString()
  return {
    id: newId(),
    kind: show.kind,
    householdId,
    showId: show.extId,
    showName: show.title,
    poster: show.poster,
    network: show.network,
    genres: show.genres,
    year: show.year,
    runtime: show.runtime,
    season: 1,
    episodesWatched: 0,
    totalEpisodes: null,
    month,
    status: 'watching',
    watchedBy,
    ratings: {},
    isRewatch: false,
    notes: '',
    createdBy,
    createdAt: now,
    updatedAt: now,
  }
}

export default function App() {
  const [auth, setAuth] = useState<Auth>(CLOUD_ENABLED ? { state: 'checking' } : { state: 'ready', session: null })
  const [watches, setWatches] = useState<Watch[]>([])
  const [people, setPeople] = useState<Person[]>([])
  useLang()
  const festive = useFestive()
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  /** Reactions and chat need migration 006; hidden until it's run */
  const [social, setSocial] = useState(false)
  /** Show in the press-and-hold quick menu */
  const [actionsFor, setActionsFor] = useState<string | null>(null)
  /** List item being logged; it leaves Up Next once logged */
  const [fromItem, setFromItem] = useState<ListItem | null>(null)
  /** Save to a list / Recommend sheet */
  const [titleSheet, setTitleSheet] = useState<{ title: Title; mode: 'save' | 'recommend' } | null>(null)
  /** New list from the Save sheet: the title goes in once the list exists */
  const [newListFor, setNewListFor] = useState<Title | null>(null)
  const [movieDraft, setMovieDraft] = useState<Watch | null>(null)
  const [listOpen, setListOpen] = useState<string | null>(null)
  /** Search adds to this list instead of logging */
  const [searchTarget, setSearchTarget] = useState<WatchList | null>(null)
  const [familyView, setFamilyView] = useState<'activity' | 'chats'>('activity')
  const [householdOpen, setHouseholdOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [tab, setTabState] = useState<Tab>('home')
  const prevTab = useRef<Tab>('home')
  const [helpTopic, setHelpTopic] = useState<string | null>(null)
  const setTab = (t: Tab) => {
    setTabState((cur) => {
      // Settings and Help have no tab of their own; remember where to go back to
      if ((t === 'settings' || t === 'help') && cur !== t && cur !== 'help') prevTab.current = cur
      return t
    })
  }
  const openHelp = (topic: string | null = null) => {
    setHelpTopic(topic)
    setTab('help')
  }
  const [month, setMonth] = useState(currentMonth())
  /** Month new shows are logged into: this month by default, or the past month you chose to fill in */
  const [addMonth, setAddMonth] = useState(currentMonth())
  const [detail, setDetail] = useState<{ watch: Watch; isNew: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ id: number; msg: string; undo?: () => void; label?: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Undo runs later than the render that created it, so read the latest list from here
  const watchesRef = useRef<Watch[]>([])
  useEffect(() => {
    watchesRef.current = watches
  }, [watches])
  const [reveals, setReveals] = useState<string[]>([])
  const [quick, setQuick] = useState<Watch | null>(null)
  const viewerRef = useRef<string | null>(null)
  useEffect(() => {
    viewerRef.current = auth.state === 'ready' ? (auth.session?.personId ?? DEV_VIEWER) : null
  }, [auth])

  const queueReveals = useCallback((list: Watch[]) => {
    const seen = readSeen()
    if (!seen) {
      // First run on this phone: don't replay history, only future reveals
      writeSeen(new Set(list.filter((w) => averageRating(w) != null).map((w) => w.id)))
      return
    }
    const ids = pendingReveals(list, viewerRef.current, seen).map((w) => w.id)
    if (ids.length) setReveals((q) => [...q, ...ids.filter((id) => !q.includes(id))])
  }, [])

  function closeReveal() {
    setReveals(([done, ...rest]) => {
      const seen = readSeen() ?? new Set<string>()
      if (done) seen.add(done)
      writeSeen(seen)
      return rest
    })
  }

  /** Short message at the bottom; with `undo` it gets an Undo button and stays a little longer. */
  const flash = useCallback((msg: string, undo?: () => void, label = 'Undo') => {
    clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), msg, undo, label })
    toastTimer.current = setTimeout(() => setToast(null), undo || msg.length > 60 ? 6000 : 3500)
  }, [])

  // Who's using the app (single-phone mode: the admin), as early as hooks need it
  const sessionPersonId = auth.state === 'ready' ? (auth.session?.personId ?? DEV_VIEWER) : null
  const mePerson = people.find((p) => p.id === (sessionPersonId ?? people.find((x) => x.isAdmin)?.id))
  const myHousehold = mePerson?.householdId ?? null
  const circle = useCircle(store, mePerson, flash)
  const takeCircle = circle.take

  // Restore an existing session on launch
  useEffect(() => {
    if (!CLOUD_ENABLED) return
    currentSession()
      .then((session) => setAuth(session ? { state: 'ready', session } : { state: 'signedOut' }))
      .catch((e: Error) => setAuth({ state: 'signedOut', error: e.message }))
  }, [])

  /** Celebrates badges earned since this phone last looked (first run just records them). */
  const checkBadges = useCallback(
    (list: Watch[]) => {
      const badges = familyBadges(list)
      const seen = readSet(BADGES_KEY)
      if (!seen) {
        writeSet(BADGES_KEY, new Set(badges.filter((b) => b.earned).map((b) => b.id)))
        return
      }
      const fresh = newlyEarned(badges, seen)
      if (!fresh.length) return
      fresh.forEach((b) => seen.add(b.id))
      writeSet(BADGES_KEY, seen)
      flash(
        fresh.length === 1
          ? t('Badge unlocked: {badge}', { badge: fresh[0].title })
          : fresh.length === 2
            ? t('Badges unlocked: {a} and {b}', { a: fresh[0].title, b: fresh[1].title })
            : t('{n} new badges unlocked · see Stats', { n: fresh.length }),
      )
    },
    [flash],
  )

  /** Where you last read each chat (this phone), for unread badges */
  const [lastRead, setLastRead] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_KEY) || '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  const markRead = useCallback((watchId: string | null) => {
    setLastRead((cur) => {
      const next = { ...cur, [threadKey(watchId)]: new Date().toISOString() }
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next))
      } catch {
        // Badges just stay a little longer
      }
      return next
    })
  }, [])
  /** Open chat on the Messages tab: undefined = the list, null = Family chat, id = a show's chat */
  const [thread, setThread] = useState<string | null | undefined>(undefined)
  const openThread = useCallback((watchId: string | null | undefined) => {
    setActionsFor(null)
    setDetail(null)
    setThread(watchId)
    setFamilyView('chats')
    setTabState('family')
  }, [])

  const [push, setPush] = useState<PushState>('off')
  useEffect(() => {
    if (auth.state !== 'ready' || !CLOUD_ENABLED) return
    pushState().then(setPush).catch(() => setPush('unsupported'))
  }, [auth.state])

  async function turnOnPush() {
    try {
      await store.savePush(await enablePush())
      setPush('on')
      flash(t("Notifications on. You'll hear about messages, @mentions and new episodes."))
    } catch (e) {
      const why = (e as Error).message
      setPush(why === 'denied' ? 'denied' : 'off')
      flash(why === 'denied' ? t('Notifications are blocked. Turn them on in your phone settings.') : why === 'dismissed' ? t('Maybe later, then.') : t("Couldn't turn on notifications. Try again."))
    }
  }

  async function turnOffPush() {
    try {
      const endpoint = await disablePush()
      if (endpoint) await store.removePush(endpoint)
      setPush('off')
      flash(t('Notifications off on this phone'))
    } catch {
      flash(t("Couldn't turn them off. Try again."))
    }
  }

  /** Opens a show page from a message, scrolled to its family chat. */
  const openShow = useCallback((w: Watch) => {
    setActionsFor(null)
    setDetail({ watch: w, isNew: false })
    // After the page's own scroll-to-top on open
    setTimeout(() => document.querySelector('.chat')?.scrollIntoView({ block: 'center' }), 600)
  }, [])

  /** "Ana on Severance: …" for chat lines and reactions that arrived since this phone last looked. */
  const announce = useCallback(
    (snap: { watches: Watch[]; people: Person[]; reactions: Reaction[]; comments: Comment[] }) => {
      const me = viewerRef.current ?? snap.people.find((p) => p.isAdmin)?.id ?? null
      const rKey = (r: Reaction) => `r:${r.watchId}:${r.personId}:${r.emoji}`
      const forMe = snap.reactions.filter((r) => r.targetId === me && r.personId !== me)
      const seen = readSet(CHAT_KEY)
      const all = [...snap.comments.map((c) => c.id), ...forMe.map(rKey)]
      if (!seen) return writeSet(CHAT_KEY, new Set(all))
      const fresh = unseenComments(snap.comments, seen, me)
      const freshR = forMe.filter((r) => !seen.has(rKey(r)))
      all.forEach((id) => seen.add(id))
      writeSet(CHAT_KEY, seen)
      const nameOf = (id: string) => snap.people.find((p) => p.id === id)?.name ?? t('Someone')
      const show = (id: string | null) => (id ? snap.watches.find((w) => w.id === id) : undefined)
      const place = (watchId: string | null) => (watchId ? t('on {show}', { show: show(watchId)?.showName ?? t('a show') }) : t('in Family chat'))
      const short = (text: string) => (text.length > 60 ? text.slice(0, 58) + '…' : text)
      // Someone @mentioned you: that's meant for you, so it comes first and shows the words
      const toMe = me ? fresh.filter((c) => mentionsIn(c.text, snap.people).includes(me)) : []
      if (toMe.length) {
        const c = toMe[toMe.length - 1]
        return flash(t('{name} mentioned you {place}: “{text}”', { name: nameOf(c.personId), place: place(c.watchId), text: short(c.text) }), () => openThread(c.watchId), 'Open')
      }
      const count = fresh.length + freshR.length
      if (count > 1) {
        const from = [...new Set([...fresh.map((c) => c.personId), ...freshR.map((r) => r.personId)])].map(nameOf).join(' & ')
        const where = new Set([...fresh.map((c) => c.watchId), ...freshR.map((r) => r.watchId)])
        if (where.size === 1 && !freshR.length) {
          const id = [...where][0]
          return flash(t('{from}: {n} new {place}', { from, n: count, place: place(id) }), () => openThread(id), 'Open')
        }
        return flash(t('{from}: {n} new messages and reactions', { from, n: count }), () => openThread(undefined), 'Open')
      }
      if (fresh.length) {
        const c = fresh[0]
        const w = show(c.watchId)
        if (c.watchId && !w) return
        // Haven't rated yet: say who wrote, not what (no nudging your stars)
        return w && chatLocked(w, me)
          ? flash(t('{name} wrote {place}', { name: nameOf(c.personId), place: place(c.watchId) }), () => openThread(c.watchId), 'Open')
          : flash(t('{name} {place}: “{text}”', { name: nameOf(c.personId), place: place(c.watchId), text: short(c.text) }), () => openThread(c.watchId), 'Open')
      }
      if (freshR.length) {
        const r = freshR[0]
        const w = show(r.watchId)
        if (w) flash(t('{name} reacted {emoji} to your stars on {show}', { name: nameOf(r.personId), emoji: r.emoji, show: w.showName }), () => openShow(w), 'Open')
      }
    },
    [flash, openShow, openThread],
  )

  const reload = useCallback(async () => {
    try {
      const snap = await store.load()
      setWatches(snap.watches)
      setPeople(snap.people)
      takeCircle(snap)
      setReactions(snap.reactions)
      setComments(snap.comments)
      setSocial(snap.social)
      setOffline(false)
      queueReveals(snap.watches)
      checkBadges(snap.watches)
      // Last, so a message meant for you isn't covered by a badge toast
      announce(snap)
    } catch {
      // Cloud unreachable: fall back to the last synced copy
      const snap = cache.read()
      setWatches(snap.watches)
      setPeople(snap.people)
      takeCircle(snap)
      setReactions(snap.reactions ?? [])
      setComments(snap.comments ?? [])
      setOffline(true)
    }
  }, [queueReveals, checkBadges, announce, takeCircle])

  useEffect(() => {
    if (auth.state !== 'ready') return
    reload()
    const unsubscribe = store.subscribe(reload)
    const onFocus = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [auth.state, reload])

  // A tapped notification: ?open=thread:<id|family> or show:<id>
  const pendingOpen = useRef<string | null>(new URLSearchParams(window.location.search).get('open'))
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'open' && e.data.open) {
        pendingOpen.current = e.data.open
        reload()
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [reload])
  useEffect(() => {
    const open = pendingOpen.current
    if (!open || !watches.length) return
    pendingOpen.current = null
    window.history.replaceState(null, '', window.location.pathname)
    const [kind, id] = open.split(':')
    if (kind === 'thread') openThread(id === 'family' ? null : id)
    else if (kind === 'list') {
      setListOpen(id)
      setTab('lists')
    } else if (kind === 'recs') {
      setFamilyView('activity')
      setTab('family')
    }
    else if (kind === 'show') {
      const w = watches.find((x) => x.id === id)
      if (w) openShow(w)
    }
  }, [watches, openThread, openShow])

  // Every screen change starts at the top (iOS keeps the old scroll position otherwise)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, detail?.watch.id])

  /**
   * Saves a log (optimistically). `undo: true` puts the previous version back on Undo
   * (or removes the log if it was new). `exact` keeps the monthly episode counts as given.
   */
  async function persist(change: Watch, okMsg: string, opts: { exact?: boolean; undo?: boolean } = {}) {
    const before = watchesRef.current.find((x) => x.id === change.id) ?? null
    // Record which month these episodes belong to (merges and undos already have them right)
    const next = opts.exact ? change : reconcileMonths(before, change)
    const put = (list: Watch[], w: Watch | null) => (w ? [...list.filter((x) => x.id !== next.id), w] : list.filter((x) => x.id !== next.id))
    setWatches((list) => put(list, next))
    try {
      await store.save(next)
      const after = put(watchesRef.current, next)
      flash(okMsg, opts.undo ? () => (before ? persist(before, t('Undone'), { exact: true }) : removeLog(next, t('Undone'))) : undefined)
      queueReveals(after)
      checkBadges(after)
      return true
    } catch {
      setWatches((list) => put(list, before))
      flash(t("Couldn't save. Check your connection and try again."))
      return false
    }
  }

  /** Removes a log; Undo brings it back with its chat and reactions. */
  async function removeLog(w: Watch, okMsg = t('{name} removed', { name: w.showName })) {
    const keepChat = comments.filter((c) => c.watchId === w.id)
    const keepReacts = reactions.filter((r) => r.watchId === w.id)
    setWatches((list) => list.filter((x) => x.id !== w.id))
    try {
      await store.remove(w.id)
      flash(okMsg, okMsg === t('Undone') ? undefined : () => restoreLog(w, keepChat, keepReacts))
      return true
    } catch (e) {
      setWatches((list) => [...list.filter((x) => x.id !== w.id), w])
      flash((e as Error).message === t('Only Leandro or the person who added it can remove this.') ? (e as Error).message : t("Couldn't remove it. Check your connection and try again."))
      return false
    }
  }

  async function restoreLog(w: Watch, chat: Comment[] = [], reacts: Reaction[] = []) {
    setWatches((list) => [...list.filter((x) => x.id !== w.id), w])
    try {
      await store.save(w)
      // Best effort: the show is back even if a message can't be restored
      await Promise.all([...chat.map((c) => store.addComment(c)), ...reacts.map((r) => store.setReaction(r))]).catch(() => undefined)
      setComments((list) => [...list.filter((c) => c.watchId !== w.id), ...chat])
      setReactions((list) => [...list.filter((r) => r.watchId !== w.id), ...reacts])
      flash(t('{name} is back', { name: w.showName }))
    } catch {
      setWatches((list) => list.filter((x) => x.id !== w.id))
      flash(t("Couldn't bring it back. Check your connection."))
    }
  }

  async function react(watchId: string, targetId: string, emoji: string) {
    if (!me) return
    const r = { watchId, personId: me, targetId, emoji }
    const prev = reactions
    const next = toggleReaction(prev, r)
    const kept = next.find((x) => x.watchId === watchId && x.personId === me && x.targetId === targetId)
    setReactions(next)
    try {
      await store.setReaction({ ...r, emoji: kept ? emoji : null })
    } catch {
      setReactions(prev)
      flash(t("Couldn't send your reaction. Check your connection."))
    }
  }

  async function sendComment(watchId: string | null, text: string) {
    if (!me) return false
    const c: Comment = { id: newId(), watchId, personId: me, text, createdAt: new Date().toISOString() }
    setComments((list) => [...list, c])
    // Your own line never gets announced back to you
    const seen = readSet(CHAT_KEY)
    if (seen) writeSet(CHAT_KEY, seen.add(c.id))
    try {
      await store.addComment(c)
      return true
    } catch {
      setComments((list) => list.filter((x) => x.id !== c.id))
      flash(t("Couldn't send it. Check your connection."))
      return false
    }
  }

  async function deleteComment(c: Comment) {
    setComments((list) => list.filter((x) => x.id !== c.id))
    try {
      await store.removeComment(c.id)
      flash(t('Message removed'), async () => {
        setComments((list) => [...list.filter((x) => x.id !== c.id), c])
        await store.addComment(c).catch(() => {
          setComments((list) => list.filter((x) => x.id !== c.id))
          flash(t("Couldn't bring it back. Check your connection."))
        })
      })
    } catch (e) {
      setComments((list) => [...list, c])
      flash((e as Error).message || t("Couldn't remove it. Check your connection."))
    }
  }

  async function handleSave(w: Watch, isNew = detail?.isNew ?? false) {
    setSaving(true)
    // Logged from a list: it's being watched now, so it leaves that list
    const item = isNew ? fromItem : null
    const before = watchesRef.current.find((x) => x.id === w.id) ?? null
    const ok = await persist(w, isNew ? t('{title} added to {month}', { title: w.showName, month: monthLabel(w.month) }) : t('Saved'))
    setSaving(false)
    if (ok) {
      // Undo: a new log goes away (and back on its list); an edit goes back
      flash(isNew ? t('{title} added to {month}', { title: w.showName, month: monthLabel(w.month) }) : t('Saved'), async () => {
        if (!before) {
          await removeLog(w, t('Undone'))
          if (item) circle.addToList(item, item.listId, true)
        } else persist(before, t('Undone'), { exact: true })
      })
      if (item) circle.removeItem(item, true)
      setFromItem(null)
      setDetail(null)
      setQuick(null)
      setMovieDraft(null)
      setMonth(w.month)
      setTab('home')
    }
  }

  /** Start logging a show or movie (a show you're already watching opens instead of making a copy). */
  function startLog(title: Title, item: ListItem | null = null, month = addMonth) {
    const open = inProgressFor(homeWatches, title.extId, title.kind)
    if (open) {
      setDetail({ watch: open, isNew: false })
      flash(t("You're already watching {title}. Mark episodes here.", { title: open.showName }))
      return
    }
    setFromItem(item)
    // Everyone who voted for it in your household is probably watching together
    const voters = item?.votes.filter((id) => members.some((p) => p.id === id)) ?? []
    const draft = draftFrom(title, month, voters.length ? voters : defaultWatchersFor(me, members), me, myHousehold)
    if (title.kind === 'movie') setMovieDraft(movieWatch({ ...draft, status: 'done' }))
    else setQuick(draft)
  }

  async function handleDelete(w: Watch) {
    setDetail(null)
    // Use the saved version: unsaved edits on the page shouldn't come back with Undo
    await removeLog(watchesRef.current.find((x) => x.id === w.id) ?? w)
  }

  /** Quick menu and +1: save with Undo, and keep Home on the month the log moved to. */
  function quickSave(next: Watch, msg: string) {
    persist(next, msg, { undo: true })
    setMonth(next.month)
  }

  if (auth.state === 'checking') {
    return (
      <div className="app loading">
        <div className="logo" aria-label={t('Loading')}>
          <Icon name="tv" size={32} stroke={2.2} />
        </div>
      </div>
    )
  }

  if (auth.state === 'signedOut') {
    return (
      <div className="app">
        {auth.error && <p className="error banner" role="alert">{auth.error}</p>}
        <Login
          loadOptions={joinOptions}
          onSignIn={async (email, password) => {
            const session = await signIn(email, password)
            setAuth({ state: 'ready', session })
          }}
          onSignUp={async (email, password, code, as) => {
            const session = await signUp(email, password, code, as)
            if (!session) return false
            setAuth({ state: 'ready', session })
            return true
          }}
        />
      </div>
    )
  }

  // Single-phone mode has no login: the phone belongs to the admin
  const viewer = auth.session?.personId ?? DEV_VIEWER
  const me = viewer ?? people.find((p) => p.isAdmin)?.id ?? null
  // Your household: its people are "Who watched?", Stats and Taste match (viewers never are)
  const members = householdMembers(people, myHousehold)
  const homeWatches = householdWatches(watches, myHousehold)
  const detailHousehold = detail?.watch.householdId ?? myHousehold
  const readOnly = auth.session?.isViewer ?? people.find((p) => p.id === me)?.isViewer ?? false
  const isAdmin = auth.session ? auth.session.isAdmin : true
  const who = auth.session ? { personId: auth.session.personId, isAdmin: auth.session.isAdmin } : null
  const unread = social ? totalUnread(comments, lastRead, me) : 0
  const newRecs = circle.recs.filter((r) => r.to === me && r.status === 'new').length
  const familyBadge = unread + newRecs
  function readOnlyFor(w: Watch | undefined): boolean {
    if (readOnly) return true
    return Boolean(w?.householdId && myHousehold && w.householdId !== myHousehold)
  }
  // Another household's show: look, chat and react, but it's their log
  const detailReadOnly = readOnlyFor(detail?.watch)

  return (
    <div className="app">
      {offline && <p className="banner warn" role="status">{t('Offline. Showing your last synced log.')}</p>}
      <UpdateBanner />
      {festive && <FestiveRain key={festive.id} festive={festive} />}

      <main>
        {detail ? (
          <Detail
            key={detail.watch.id}
            initial={detail.watch}
            isNew={detail.isNew}
            watches={watches}
            people={householdMembers(people, detailHousehold)}
            everyone={people}
            readOnly={detailReadOnly}
            owner={detailReadOnly && !readOnly ? householdLabel(circle.households.find((h) => h.id === detail.watch.householdId), people) : null}
            onMore={(title) => setTitleSheet({ title, mode: 'save' })}
            me={me}
            viewer={viewer}
            saving={saving}
            canDelete={canDelete(detail.watch, who)}
            onSave={handleSave}
            onDelete={handleDelete}
            onFlash={flash}
            social={social && !detail.isNew}
            reactions={reactions}
            comments={comments}
            onReact={(targetId, emoji) => react(detail.watch.id, targetId, emoji)}
            onComment={(text) => sendComment(detail.watch.id, text)}
            onRemoveComment={deleteComment}
            onChatSeen={() => markRead(detail.watch.id)}
            onRate={(personId, stars) => {
              const saved = watchesRef.current.find((x) => x.id === detail.watch.id)
              if (!saved) return
              const name = people.find((p) => p.id === personId)?.name
              persist(setOwnRating(saved, personId, stars), stars ? (personId === me ? t('Your {stars}★ saved', { stars }) : t("{name}'s {stars}★ saved", { name: name ?? '', stars })) : t('Rating cleared'), { exact: true, undo: true })
            }}
            onMerge={async (keep, drop) => {
              if (!canDelete(drop, who)) {
                flash(t('Ask {name} to merge these: you can only remove logs you added.', { name: people.find((p) => p.isAdmin)?.name ?? t('the admin') }))
                return
              }
              const keepBefore = watchesRef.current.find((x) => x.id === keep.id) ?? keep
              const merged = mergeLogs(keep, drop)
              const ok = await persist(merged, t('Merged into one log'), { exact: true })
              if (!ok) return
              setWatches((list) => list.filter((x) => x.id !== drop.id))
              const dropChat = comments.filter((c) => c.watchId === drop.id)
              const dropReacts = reactions.filter((r) => r.watchId === drop.id)
              try {
                await store.remove(drop.id)
                flash(t('Merged into one log'), async () => {
                  await persist(keepBefore, t('Undone'), { exact: true })
                  await restoreLog(drop, dropChat, dropReacts)
                })
              } catch {
                flash(t("Merged, but couldn't remove the old copy. Try again from it."))
              }
              setDetail(null)
            }}
            onClose={() => setDetail(null)}
          />
        ) : tab === 'home' ? (
          <Home
            watches={homeWatches}
            people={members}
            me={me}
            viewer={viewer}
            onProfile={() => setTab('settings')}
            filter={filter}
            onFilter={setFilter}
            month={month}
            onMonth={setMonth}
            onOpen={(w) => setDetail({ watch: w, isNew: false })}
            onAddEpisode={(w) => {
              const next = addEpisode(w)
              quickSave(next, next.status === 'done' ? t('{show} S{season} finished', { show: w.showName, season: w.season }) : t('Episode {n} logged', { n: next.episodesWatched }))
            }}
            onActions={(w) => setActionsFor(w.id)}
            readOnly={readOnly}
            everyone={people}
            festive={festive}
            onAdd={() => {
              setAddMonth(month)
              setTab('search')
            }}
          />
        ) : tab === 'search' ? (
          <Search
            watches={homeWatches}
            month={addMonth}
            onMonth={setAddMonth}
            target={searchTarget}
            onCancelTarget={() => setSearchTarget(null)}
            onTarget={new Set(circle.items.filter((i) => i.listId === searchTarget?.id).map((i) => `${i.kind}:${i.extId}`))}
            onPick={(title) => startLog(title)}
            onAddToList={(title) => searchTarget && circle.addToList(title, searchTarget.id)}
            onMore={(title) => setTitleSheet({ title, mode: 'save' })}
            readOnly={readOnly}
          />
        ) : tab === 'help' ? (
          <Help key={helpTopic ?? 'all'} topic={helpTopic} onBack={() => setTab(prevTab.current)} />
        ) : tab === 'lists' ? (
          <Lists
            lists={circle.lists}
            items={circle.items}
            people={people}
            households={circle.households}
            me={mePerson}
            open={listOpen}
            onOpen={setListOpen}
            onVote={circle.vote}
            onRemove={(item) => circle.removeItem(item)}
            onWatch={(item) => startLog(item, item, currentMonth())}
            onAdd={(list) => {
              setSearchTarget(list)
              setTab('search')
            }}
            onSave={circle.saveList}
            onDelete={(l) => {
              circle.deleteList(l)
              setListOpen(null)
            }}
            onMore={(item) => setTitleSheet({ title: item, mode: 'recommend' })}
          />
        ) : tab === 'family' ? (
          <Family
            view={familyView}
            onView={(v) => {
              setFamilyView(v)
              setThread(undefined)
            }}
            unread={unread}
            watches={watches}
            lists={circle.lists}
            recs={circle.recs}
            people={people}
            households={circle.households}
            me={mePerson}
            household={householdOpen}
            onHousehold={setHouseholdOpen}
            onOpenWatch={(w) => setDetail({ watch: w, isNew: false })}
            onOpenList={(id) => {
              setListOpen(id)
              setTab('lists')
            }}
            onAnswer={circle.answer}
            chats={
              <Messages
                embedded
                comments={comments}
                watches={watches}
                people={people}
                me={me}
                lastRead={lastRead}
                thread={thread}
                onThread={setThread}
                onSend={sendComment}
                onRemove={deleteComment}
                onSeen={markRead}
                onOpenShow={openShow}
                mutes={circle.mutes}
                onMute={circle.mute}
                notify={(store.mode === 'cloud' || import.meta.env.DEV) && social ? { state: push, onEnable: turnOnPush } : null}
              />
            }
          />
        ) : tab === 'stats' ? (
          <Stats
            onHelp={openHelp}
            onFlash={flash}
            watches={homeWatches}
            people={members}
            filter={filter}
            onFilter={setFilter}
            onOpen={(w) => setDetail({ watch: w, isNew: false })}
          />
        ) : (
          <Settings
            key={tab}
            view={tab === 'members' ? 'family' : 'account'}
            onOpenSettings={() => setTab('settings')}
            onOpenFamily={() => setTab('members')}
            loadViewerInvite={store.mode === 'cloud' ? getViewerCode : null}
            households={circle.households}
            meId={me}
            admin={{
              onAddHousehold: async (name) => {
                try {
                  const { code } = await store.addHousehold(name)
                  await reload()
                  flash(t('{name} created. Send them the invite.', { name }))
                  return code
                } catch (e) {
                  flash((e as Error).message || t("Couldn't create it. Check your connection."))
                  return null
                }
              },
              onUpdateHousehold: async (h) => {
                try {
                  await store.updateHousehold(h)
                  await reload()
                } catch (e) {
                  flash((e as Error).message || t("Couldn't save that. Check your connection."))
                }
              },
              onMovePerson: async (personId, householdId) => {
                try {
                  await store.movePerson(personId, householdId)
                  await reload()
                  flash(t('Moved'))
                } catch (e) {
                  flash((e as Error).message || t("Couldn't move them. Check your connection."))
                }
              },
              onAddPerson: async (name, householdId) => {
                try {
                  await store.addPerson(name, householdId)
                  await reload()
                  flash(t('{name} added', { name }))
                } catch (e) {
                  flash((e as Error).message || t("Couldn't add them. Check your connection."))
                }
              },
              householdCode: (id) => store.householdCode(id),
            }}
            onSetViewer={async (id, viewer) => {
              const prev = people
              setPeople((list) => list.map((p) => (p.id === id ? { ...p, isViewer: viewer } : p)))
              try {
                await store.setViewer(id, viewer)
                flash(viewer ? t('Now a viewer: sees and chats only') : t('Now a full member'))
              } catch (e) {
                setPeople(prev)
                flash((e as Error).message || t("Couldn't change that. Check your connection."))
              }
            }}
            notify={store.mode === 'cloud' || import.meta.env.DEV ? { state: push, onEnable: turnOnPush, onDisable: turnOffPush } : null}
            onOpenHelp={() => openHelp()}
            onBack={() => setTab(prevTab.current)}
            mode={store.mode}
            session={auth.session}
            isAdmin={isAdmin}
            people={people}
            watches={watches}
            loadInvite={store.mode === 'cloud' ? getInviteCode : null}
            renewInvite={store.mode === 'cloud' ? renewInviteCode : null}
            onAddPerson={async (name) => {
              const person = await store.addPerson(name)
              setPeople((list) => [...list, person])
              flash(t('{name} added to the family', { name }))
            }}
            onSignOut={async () => {
              await signOut()
              setWatches([])
              setPeople([])
              setAuth({ state: 'signedOut' })
            }}
          />
        )}
      </main>

      {quick && (
        <QuickLog
          key={quick.id}
          draft={quick}
          watches={watches}
          people={members}
          me={me}
          saving={saving}
          onLog={(w) => handleSave(w, true)}
          onMore={(w) => {
            setQuick(null)
            setDetail({ watch: w, isNew: true })
          }}
          onClose={() => {
            setQuick(null)
            setFromItem(null)
          }}
        />
      )}

      {movieDraft && (
        <MovieLog
          key={movieDraft.id}
          draft={movieDraft}
          watches={homeWatches}
          people={members}
          me={me}
          saving={saving}
          onLog={(w) => handleSave(w, true)}
          onSaveForLater={async (w) => {
            setMovieDraft(null)
            await circle.addToList({ kind: 'movie', extId: w.showId, title: w.showName, poster: w.poster, year: w.year, genres: w.genres, runtime: w.runtime, network: w.network })
          }}
          onClose={() => {
            setMovieDraft(null)
            setFromItem(null)
          }}
        />
      )}

      {titleSheet && (
        <TitleSheet
          title={titleSheet.title}
          mode={titleSheet.mode}
          lists={circle.lists}
          items={circle.items}
          people={people}
          households={circle.households}
          me={mePerson}
          onSave={(listId) => circle.addToList(titleSheet.title, listId)}
          onRecommend={(to, note) => circle.recommend(titleSheet.title, to, note)}
          onNewList={() => {
            setNewListFor(titleSheet.title)
            setTitleSheet(null)
          }}
          onClose={() => setTitleSheet(null)}
        />
      )}

      {newListFor && (
        <ListEditor
          list={null}
          people={people}
          me={mePerson}
          onSave={async (l, msg) => {
            const ok = await circle.saveList(l, msg)
            if (ok) await circle.addToList(newListFor, l.id, true)
            return ok
          }}
          onDelete={() => undefined}
          onClose={() => setNewListFor(null)}
        />
      )}

      {reveals[0] && watches.find((w) => w.id === reveals[0]) && (
        <Reveal
          watch={watches.find((w) => w.id === reveals[0])!}
          people={people}
          viewer={social ? me : null}
          reactions={reactions}
          onReact={(targetId, emoji) => react(reveals[0], targetId, emoji)}
          onClose={closeReveal}
        />
      )}

      {actionsFor && watches.find((w) => w.id === actionsFor) && (
        <QuickActions
          watch={watches.find((w) => w.id === actionsFor)!}
          people={members}
          me={me}
          onEpisode={(w) => {
            const next = addEpisode(w)
            quickSave(next, next.status === 'done' ? t('{show} S{season} finished', { show: w.showName, season: w.season }) : t('Episode {n} logged', { n: next.episodesWatched }))
          }}
          onFinish={(w, aired) => {
            const next = finishSeason(w, aired)
            quickSave(next, next.status === 'done' ? t('{show} S{season} finished', { show: w.showName, season: w.season }) : t('Caught up on {show}', { show: w.showName }))
          }}
          onJoin={(w) => me && persist(joinWatchers(w, me), t("You're on {show} now", { show: w.showName }), { undo: true })}
          onRate={(w, stars) => me && persist(setOwnRating(w, me, stars), stars ? t('{stars}★ for {show}', { stars, show: w.showName }) : t('Rating cleared'), { undo: true })}
          onOpen={(w) => {
            setActionsFor(null)
            setDetail({ watch: w, isNew: false })
          }}
          onClose={() => setActionsFor(null)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.undo ? 'has-undo' : ''}`} role="status" key={toast.id}>
          <Icon name="check" size={18} stroke={2.6} /> <span className="toast-msg">{toast.msg}</span>
          {toast.undo && (
            <button
              className="toast-undo"
              onClick={() => {
                const undo = toast.undo!
                clearTimeout(toastTimer.current)
                setToast(null)
                undo()
              }}
            >
              {t(toast.label ?? 'Undo')}
            </button>
          )}
        </div>
      )}

      {!detail && (
        <nav className="tabbar" aria-label={t('Main')}>
          {SIDE_TABS.map((group, gi) => (
            <Fragment key={gi}>
              {gi === 1 && !readOnly && (
                <button
                  className={`fab ${tab === 'search' ? 'on' : ''}`}
                  aria-label={t('Add a show')}
                  onClick={() => {
                    setAddMonth(currentMonth())
                    setTab('search')
                  }}
                >
                  <Icon name="plus" size={28} stroke={2.6} />
                </button>
              )}
              {group.map((tb) => (
                <button
                  key={tb.id}
                  className={`tab ${tab === tb.id ? 'on' : ''}`}
                  aria-current={tab === tb.id ? 'page' : undefined}
                  onClick={() => {
                    if (tb.id === 'family') {
                      setThread(undefined)
                      setHouseholdOpen(null)
                    }
                    if (tb.id === 'lists') setListOpen(null)
                    setTab(tb.id)
                  }}
                >
                  <Icon name={tb.icon} size={23} />
                  {tb.id === 'family' && familyBadge > 0 && <i className="tab-badge" aria-label={t('{n} new', { n: familyBadge })}>{familyBadge > 9 ? '9+' : familyBadge}</i>}
                  <span>{t(tb.label)}</span>
                </button>
              ))}
            </Fragment>
          ))}
        </nav>
      )}
    </div>
  )
}
