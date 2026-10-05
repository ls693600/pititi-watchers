import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, averageRating, familyBadges, newlyEarned, toggleWant, byUpdatedDesc, canDelete, currentMonth, monthLabel, newId, pendingReveals } from './logic'
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
import type { Person, UpNextItem, Watch } from './types'

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

/** New logs start with the same group as your latest log (usually the people you watch with). */
function defaultWatchers(watches: Watch[], people: Person[], me: string | null): string[] {
  const last = [...watches].sort(byUpdatedDesc).find((w) => !me || w.watchedBy.includes(me))
  const known = new Set(people.map((p) => p.id))
  const group = last?.watchedBy.filter((id) => known.has(id)) ?? []
  if (group.length) return group
  return me ? [me] : people.slice(0, 1).map((p) => p.id)
}

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
  const [detail, setDetail] = useState<{ watch: Watch; isNew: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
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

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
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

  const reload = useCallback(async () => {
    try {
      const snap = await store.load()
      setWatches(snap.watches)
      setPeople(snap.people)
      setUpNext(snap.upNext)
      setOffline(false)
      queueReveals(snap.watches)
      checkBadges(snap.watches)
    } catch {
      // Cloud unreachable: fall back to the last synced copy
      const snap = cache.read()
      setWatches(snap.watches)
      setPeople(snap.people)
      setUpNext(snap.upNext ?? [])
      setOffline(true)
    }
  }, [queueReveals, checkBadges])

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

  async function persist(next: Watch, okMsg: string) {
    const prev = watches
    setWatches((list) => [...list.filter((x) => x.id !== next.id), next])
    try {
      await store.save(next)
      flash(okMsg)
      queueReveals([...prev.filter((x) => x.id !== next.id), next])
      checkBadges([...prev.filter((x) => x.id !== next.id), next])
      return true
    } catch {
      setWatches(prev)
      flash("Couldn't save. Check your connection and try again.")
      return false
    }
  }

  async function handleSave(w: Watch, isNew = detail?.isNew ?? false) {
    setSaving(true)
    const ok = await persist(w, isNew ? `${w.showName} added to ${monthLabel(w.month)}` : 'Saved')
    setSaving(false)
    if (ok) {
      // Logged from Up Next: it's being watched now, so it leaves the queue
      const queued = upNext.find((i) => i.id === fromUpNext || i.showId === w.showId)
      if (queued && isNew) removeQueued(queued, true)
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
      if (!quiet) flash(`${item.showName} removed from Up Next`)
    } catch (e) {
      setUpNext(prev)
      if (!quiet) flash((e as Error).message || "Couldn't remove it. Check your connection.")
    }
  }

  async function handleDelete(w: Watch) {
    const prev = watches
    setWatches((list) => list.filter((x) => x.id !== w.id))
    setDetail(null)
    try {
      await store.remove(w.id)
      flash(`${w.showName} removed`)
    } catch {
      setWatches(prev)
      flash("Couldn't remove it. Check your connection and try again.")
    }
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
              persist(next, next.status === 'done' ? `${w.showName} S${w.season} finished` : `Episode ${next.episodesWatched} logged`)
              setMonth(next.month)
            }}
            onAdd={() => setTab('search')}
          />
        ) : tab === 'search' ? (
          <Search
            watches={watches}
            month={month}
            queued={new Set(upNext.map((i) => i.showId))}
            onQueue={queueShow}
            onPick={(show) => setQuick(draftFrom(show, month, defaultWatchers(watches, people, me), me))}
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
            onFind={() => setTab('search')}
            onLog={(item) => {
              setFromUpNext(item.id)
              // Everyone who hearted it is probably watching together
              const watchers = item.wantedBy.length ? item.wantedBy : defaultWatchers(watches, people, me)
              setQuick(draftFrom(item, currentMonth(), watchers, me))
            }}
          />
        ) : tab === 'stats' ? (
          <Stats
            onHelp={openHelp}
            watches={watches}
            people={people}
            filter={filter}
            onFilter={setFilter}
            onOpen={(w) => setDetail({ watch: w, isNew: false })}
            onOpenMonth={(m) => {
              setMonth(m)
              setTab('home')
            }}
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
        <Reveal watch={watches.find((w) => w.id === reveals[0])!} people={people} onClose={closeReveal} />
      )}

      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} stroke={2.6} /> {toast}
        </div>
      )}

      {!detail && (
        <nav className="tabbar" aria-label="Main">
          {SIDE_TABS.map((group, gi) => (
            <Fragment key={gi}>
              {gi === 1 && (
                <button className={`fab ${tab === 'search' ? 'on' : ''}`} aria-label="Add a show" onClick={() => setTab('search')}>
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
