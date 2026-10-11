import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, averageRating, chatLocked, mentionsIn, defaultWatchersFor, finishSeason, joinWatchers, mergeLogs, familyBadges, inProgressFor, newlyEarned, reconcileMonths, setOwnRating, toggleReaction, toggleWant, canDelete, currentMonth, monthLabel, newId, pendingReveals, unseenComments } from './logic'
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
import { Stats } from './screens/Stats'
import { UpNext } from './screens/UpNext'
import { cloudStore, currentSession, getInviteCode, joinOptions, renewInviteCode, signIn, signOut, signUp } from './store/cloud'
import { cache, localStore } from './store/local'
import type { Session } from './store/store'
import type { ShowResult } from './tvmaze'
import type { Comment, Person, Reaction, UpNextItem, Watch } from './types'

const store = CLOUD_ENABLED ? cloudStore : localStore

type Tab = 'home' | 'upnext' | 'search' | 'stats' | 'family' | 'settings' | 'help'
// Settings lives behind your avatar (Home) and the gear on Family
const SIDE_TABS: { id: Tab; icon: IconName; label: string }[][] = [
  [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'upnext', icon: 'list', label: 'Up Next' },
  ],
  [
    { id: 'stats', icon: 'chart', label: 'Stats' },
    { id: 'family', icon: 'users', label: 'Family' },
  ],
]

/** Dev previews only: ?as=<personId> acts as that person in single-phone mode. Stripped from production builds. */
const DEV_VIEWER = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('as') : null

const SEEN_KEY = 'pititi.reveals.v1'
const BADGES_KEY = 'pititi.badges.v1'
/** Family chat lines and reactions this phone has already announced */
const CHAT_KEY = 'pititi.chatseen.v1'

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


function draftFrom(show: ShowResult, month: string, watchedBy: string[], createdBy: string | null): Watch {
  const now = new Date().toISOString()
  return {
    id: newId(),
    showId: show.showId,
    showName: show.showName,
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
  const [upNext, setUpNext] = useState<UpNextItem[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  /** Reactions and chat need migration 006; hidden until it's run */
  const [social, setSocial] = useState(false)
  /** Show in the press-and-hold quick menu */
  const [actionsFor, setActionsFor] = useState<string | null>(null)
  /** Up Next item being logged via Quick log; removed from the list once logged */
  const [fromUpNext, setFromUpNext] = useState<string | null>(null)
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
          ? `Badge unlocked: ${fresh[0].title}`
          : fresh.length === 2
            ? `Badges unlocked: ${fresh[0].title} and ${fresh[1].title}`
            : `${fresh.length} new badges unlocked · see Stats`,
      )
    },
    [flash],
  )

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
      const nameOf = (id: string) => snap.people.find((p) => p.id === id)?.name ?? 'Someone'
      const show = (id: string) => snap.watches.find((w) => w.id === id)
      // Someone @mentioned you: that's meant for you, so it comes first and shows the words
      const toMe = me ? fresh.filter((c) => mentionsIn(c.text, snap.people).includes(me)) : []
      if (toMe.length) {
        const c = toMe[toMe.length - 1]
        const w = show(c.watchId)
        if (w) return flash(`${nameOf(c.personId)} mentioned you on ${w.showName}: “${c.text.length > 60 ? c.text.slice(0, 58) + '…' : c.text}”`, () => openShow(w), 'Open')
      }
      const count = fresh.length + freshR.length
      if (count > 1) {
        const shows = new Set([...fresh.map((c) => c.watchId), ...freshR.map((r) => r.watchId)])
        const from = [...new Set([...fresh.map((c) => c.personId), ...freshR.map((r) => r.personId)])].map(nameOf).join(' & ')
        const one = shows.size === 1 ? show([...shows][0]) : undefined
        return one ? flash(`${from}: ${count} new on ${one.showName}`, () => openShow(one), 'Open') : flash(`${from}: ${count} new messages and reactions`)
      }
      if (fresh.length) {
        const c = fresh[0]
        const w = show(c.watchId)
        if (!w) return
        // Haven't rated yet: say who wrote, not what (no nudging your stars)
        return chatLocked(w, me)
          ? flash(`${nameOf(c.personId)} wrote about ${w.showName}`, () => openShow(w), 'Open')
          : flash(`${nameOf(c.personId)} on ${w.showName}: “${c.text.length > 60 ? c.text.slice(0, 58) + '…' : c.text}”`, () => openShow(w), 'Open')
      }
      if (freshR.length) {
        const r = freshR[0]
        const w = show(r.watchId)
        if (w) flash(`${nameOf(r.personId)} reacted ${r.emoji} to your stars on ${w.showName}`, () => openShow(w), 'Open')
      }
    },
    [flash, openShow],
  )

  const reload = useCallback(async () => {
    try {
      const snap = await store.load()
      setWatches(snap.watches)
      setPeople(snap.people)
      setUpNext(snap.upNext)
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
      setUpNext(snap.upNext ?? [])
      setReactions(snap.reactions ?? [])
      setComments(snap.comments ?? [])
      setOffline(true)
    }
  }, [queueReveals, checkBadges, announce])

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
      flash(okMsg, opts.undo ? () => (before ? persist(before, 'Undone', { exact: true }) : removeLog(next, 'Undone')) : undefined)
      queueReveals(after)
      checkBadges(after)
      return true
    } catch {
      setWatches((list) => put(list, before))
      flash("Couldn't save. Check your connection and try again.")
      return false
    }
  }

  /** Removes a log; Undo brings it back with its chat and reactions. */
  async function removeLog(w: Watch, okMsg = `${w.showName} removed`) {
    const keepChat = comments.filter((c) => c.watchId === w.id)
    const keepReacts = reactions.filter((r) => r.watchId === w.id)
    setWatches((list) => list.filter((x) => x.id !== w.id))
    try {
      await store.remove(w.id)
      flash(okMsg, okMsg === 'Undone' ? undefined : () => restoreLog(w, keepChat, keepReacts))
      return true
    } catch (e) {
      setWatches((list) => [...list.filter((x) => x.id !== w.id), w])
      flash((e as Error).message?.startsWith('Only') ? (e as Error).message : "Couldn't remove it. Check your connection and try again.")
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
      flash(`${w.showName} is back`)
    } catch {
      setWatches((list) => list.filter((x) => x.id !== w.id))
      flash("Couldn't bring it back. Check your connection.")
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
      flash("Couldn't send your reaction. Check your connection.")
    }
  }

  async function sendComment(watchId: string, text: string) {
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
      flash("Couldn't send it. Check your connection.")
      return false
    }
  }

  async function deleteComment(c: Comment) {
    setComments((list) => list.filter((x) => x.id !== c.id))
    try {
      await store.removeComment(c.id)
      flash('Message removed', async () => {
        setComments((list) => [...list.filter((x) => x.id !== c.id), c])
        await store.addComment(c).catch(() => {
          setComments((list) => list.filter((x) => x.id !== c.id))
          flash("Couldn't bring it back. Check your connection.")
        })
      })
    } catch (e) {
      setComments((list) => [...list, c])
      flash((e as Error).message || "Couldn't remove it. Check your connection.")
    }
  }

  async function handleSave(w: Watch, isNew = detail?.isNew ?? false) {
    setSaving(true)
    const queued = isNew ? upNext.find((i) => i.id === fromUpNext || i.showId === w.showId) : undefined
    const before = watchesRef.current.find((x) => x.id === w.id) ?? null
    const ok = await persist(w, isNew ? `${w.showName} added to ${monthLabel(w.month)}` : 'Saved')
    setSaving(false)
    if (ok) {
      // Undo: a new log goes away (and back into Up Next if it came from there); an edit goes back
      flash(isNew ? `${w.showName} added to ${monthLabel(w.month)}` : 'Saved', async () => {
        if (!before) {
          await removeLog(w, 'Undone')
          if (queued) restoreQueued(queued)
        } else persist(before, 'Undone', { exact: true })
      })
      // Logged from Up Next: it's being watched now, so it leaves the queue
      if (queued) removeQueued(queued, true)
      setFromUpNext(null)
      setDetail(null)
      setQuick(null)
      setMonth(w.month)
      setTab('home')
    }
  }

  async function queueShow(show: ShowResult) {
    if (upNext.some((i) => i.showId === show.showId)) return
    const item: UpNextItem = {
      id: newId(),
      showId: show.showId,
      showName: show.showName,
      poster: show.poster,
      network: show.network,
      genres: show.genres,
      year: show.year,
      runtime: show.runtime,
      addedBy: viewerRef.current ?? me,
      // Saving a show counts as wanting it
      wantedBy: me ? [me] : [],
      createdAt: new Date().toISOString(),
    }
    setUpNext((list) => [...list, item])
    try {
      await store.addUpNext(item)
      flash(`${show.showName} saved to Up Next`)
    } catch (e) {
      setUpNext((list) => list.filter((x) => x.id !== item.id))
      flash((e as Error).message || "Couldn't save it. Check your connection.")
    }
  }

  async function toggleHeart(item: UpNextItem) {
    if (!me) return
    const prev = upNext
    setUpNext((list) => list.map((x) => (x.id === item.id ? toggleWant(x, me) : x)))
    try {
      const wantedBy = await store.toggleWant(item.id, me)
      setUpNext((list) => list.map((x) => (x.id === item.id ? { ...x, wantedBy } : x)))
    } catch {
      setUpNext(prev)
      flash("Couldn't save your heart. Check your connection.")
    }
  }

  async function removeQueued(item: UpNextItem, quiet = false) {
    const prev = upNext
    setUpNext((list) => list.filter((x) => x.id !== item.id))
    try {
      await store.removeUpNext(item.id)
      if (!quiet) flash(`${item.showName} removed from Up Next`, () => restoreQueued(item))
    } catch (e) {
      setUpNext(prev)
      if (!quiet) flash((e as Error).message || "Couldn't remove it. Check your connection.")
    }
  }

  async function restoreQueued(item: UpNextItem) {
    setUpNext((list) => [...list.filter((x) => x.showId !== item.showId), item])
    try {
      await store.addUpNext(item)
    } catch {
      setUpNext((list) => list.filter((x) => x.id !== item.id))
      flash("Couldn't put it back in Up Next. Check your connection.")
    }
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
        <div className="logo" aria-label="Loading">
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
  const isAdmin = auth.session ? auth.session.isAdmin : true
  const who = auth.session ? { personId: auth.session.personId, isAdmin: auth.session.isAdmin } : null

  return (
    <div className="app">
      {offline && <p className="banner warn" role="status">Offline. Showing your last synced log.</p>}
      <UpdateBanner />

      <main>
        {detail ? (
          <Detail
            key={detail.watch.id}
            initial={detail.watch}
            isNew={detail.isNew}
            watches={watches}
            people={people}
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
            onMerge={async (keep, drop) => {
              if (!canDelete(drop, who)) {
                flash(`Ask ${people.find((p) => p.isAdmin)?.name ?? 'the admin'} to merge these: you can only remove logs you added.`)
                return
              }
              const keepBefore = watchesRef.current.find((x) => x.id === keep.id) ?? keep
              const merged = mergeLogs(keep, drop)
              const ok = await persist(merged, 'Merged into one log', { exact: true })
              if (!ok) return
              setWatches((list) => list.filter((x) => x.id !== drop.id))
              const dropChat = comments.filter((c) => c.watchId === drop.id)
              const dropReacts = reactions.filter((r) => r.watchId === drop.id)
              try {
                await store.remove(drop.id)
                flash('Merged into one log', async () => {
                  await persist(keepBefore, 'Undone', { exact: true })
                  await restoreLog(drop, dropChat, dropReacts)
                })
              } catch {
                flash("Merged, but couldn't remove the old copy. Try again from it.")
              }
              setDetail(null)
            }}
            onClose={() => setDetail(null)}
          />
        ) : tab === 'home' ? (
          <Home
            watches={watches}
            people={people}
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
              quickSave(next, next.status === 'done' ? `${w.showName} S${w.season} finished` : `Episode ${next.episodesWatched} logged`)
            }}
            onActions={(w) => setActionsFor(w.id)}
            onAdd={() => {
              setAddMonth(month)
              setTab('search')
            }}
          />
        ) : tab === 'search' ? (
          <Search
            watches={watches}
            month={addMonth}
            onMonth={setAddMonth}
            queued={new Set(upNext.map((i) => i.showId))}
            onQueue={queueShow}
            onPick={(show) => {
              // Already watching it: open that log instead of starting a duplicate
              const open = inProgressFor(watches, show.showId)
              if (open) {
                setDetail({ watch: open, isNew: false })
                flash(`You're already watching ${open.showName}. Mark episodes here.`)
                return
              }
              setQuick(draftFrom(show, addMonth, defaultWatchersFor(me, people), me))
            }}
          />
        ) : tab === 'help' ? (
          <Help key={helpTopic ?? 'all'} topic={helpTopic} onBack={() => setTab(prevTab.current)} />
        ) : tab === 'upnext' ? (
          <UpNext
            items={upNext}
            people={people}
            me={me}
            canRemove={(item) => isAdmin || item.addedBy === me}
            onToggle={toggleHeart}
            onRemove={(item) => removeQueued(item)}
            onFind={() => {
              setAddMonth(currentMonth())
              setTab('search')
            }}
            onLog={(item) => {
              setFromUpNext(item.id)
              // Everyone who hearted it is probably watching together
              const watchers = item.wantedBy.length ? item.wantedBy : defaultWatchersFor(me, people)
              setQuick(draftFrom(item, currentMonth(), watchers, me))
            }}
          />
        ) : tab === 'stats' ? (
          <Stats
            onHelp={openHelp}
            onFlash={flash}
            watches={watches}
            people={people}
            filter={filter}
            onFilter={setFilter}
            onOpen={(w) => setDetail({ watch: w, isNew: false })}
          />
        ) : (
          <Settings
            key={tab}
            view={tab === 'family' ? 'family' : 'account'}
            onOpenSettings={() => setTab('settings')}
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
              flash(`${name} added to the family`)
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
          people={people}
          me={me}
          saving={saving}
          onLog={(w) => handleSave(w, true)}
          onMore={(w) => {
            setQuick(null)
            setDetail({ watch: w, isNew: true })
          }}
          onClose={() => {
            setQuick(null)
            setFromUpNext(null)
          }}
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
          people={people}
          me={me}
          onEpisode={(w) => {
            const next = addEpisode(w)
            quickSave(next, next.status === 'done' ? `${w.showName} S${w.season} finished` : `Episode ${next.episodesWatched} logged`)
          }}
          onFinish={(w, aired) => {
            const next = finishSeason(w, aired)
            quickSave(next, next.status === 'done' ? `${w.showName} S${w.season} finished` : `Caught up on ${w.showName}`)
          }}
          onJoin={(w) => me && persist(joinWatchers(w, me), `You're on ${w.showName} now`, { undo: true })}
          onRate={(w, stars) => me && persist(setOwnRating(w, me, stars), stars ? `${stars}★ for ${w.showName}` : 'Rating cleared', { undo: true })}
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
              {toast.label ?? 'Undo'}
            </button>
          )}
        </div>
      )}

      {!detail && (
        <nav className="tabbar" aria-label="Main">
          {SIDE_TABS.map((group, gi) => (
            <Fragment key={gi}>
              {gi === 1 && (
                <button
                  className={`fab ${tab === 'search' ? 'on' : ''}`}
                  aria-label="Add a show"
                  onClick={() => {
                    setAddMonth(currentMonth())
                    setTab('search')
                  }}
                >
                  <Icon name="plus" size={28} stroke={2.6} />
                </button>
              )}
              {group.map((t) => (
                <button
                  key={t.id}
                  className={`tab ${tab === t.id ? 'on' : ''}`}
                  aria-current={tab === t.id ? 'page' : undefined}
                  onClick={() => setTab(t.id)}
                >
                  <Icon name={t.icon} size={23} />
                  <span>{t.label}</span>
                </button>
              ))}
            </Fragment>
          ))}
        </nav>
      )}
    </div>
  )
}
