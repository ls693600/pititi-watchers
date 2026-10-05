import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, averageRating, byUpdatedDesc, canDelete, currentMonth, monthLabel, newId, pendingReveals } from './logic'
import { QuickLog } from './components/QuickLog'
import { Reveal } from './components/Reveal'
import { Detail } from './screens/Detail'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Search } from './screens/Search'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import { cloudStore, currentSession, getInviteCode, joinOptions, renewInviteCode, signIn, signOut, signUp } from './store/cloud'
import { cache, localStore } from './store/local'
import type { Session } from './store/store'
import type { ShowResult } from './tvmaze'
import type { Person, Watch } from './types'

const store = CLOUD_ENABLED ? cloudStore : localStore

type Tab = 'home' | 'search' | 'stats' | 'family' | 'settings'
const SIDE_TABS: { id: Tab; icon: IconName; label: string }[][] = [
  [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'stats', icon: 'chart', label: 'Stats' },
  ],
  [
    { id: 'family', icon: 'users', label: 'Family' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ],
]

/** Dev previews only: ?as=<personId> acts as that person in single-phone mode. Stripped from production builds. */
const DEV_VIEWER = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('as') : null

const SEEN_KEY = 'pititi.reveals.v1'

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
  const [filter, setFilter] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
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

  const reload = useCallback(async () => {
    try {
      const snap = await store.load()
      setWatches(snap.watches)
      setPeople(snap.people)
      setOffline(false)
      queueReveals(snap.watches)
    } catch {
      // Cloud unreachable: fall back to the last synced copy
      const snap = cache.read()
      setWatches(snap.watches)
      setPeople(snap.people)
      setOffline(true)
    }
  }, [queueReveals])

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
      setDetail(null)
      setQuick(null)
      setMonth(w.month)
      setTab('home')
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
          <Search watches={watches} month={month} onPick={(show) =>
              setQuick(draftFrom(show, month, defaultWatchers(watches, people, me), me))
            } />
        ) : tab === 'stats' ? (
          <Stats
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
          onClose={() => setQuick(null)}
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
