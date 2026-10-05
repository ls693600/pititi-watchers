import { useCallback, useEffect, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, currentMonth, monthLabel, newId } from './logic'
import { Detail } from './screens/Detail'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Search } from './screens/Search'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import { cloudStore, currentSession, signIn, signOut } from './store/cloud'
import { cache, localStore } from './store/local'
import type { Session } from './store/store'
import type { ShowResult } from './tvmaze'
import type { Watch } from './types'

const store = CLOUD_ENABLED ? cloudStore : localStore

type Tab = 'home' | 'search' | 'stats' | 'settings'
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'search', icon: 'search', label: 'Add' },
  { id: 'stats', icon: 'chart', label: 'Stats' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
]

type Auth = { state: 'checking' } | { state: 'signedOut'; error?: string } | { state: 'ready'; session: Session | null }

function draftFrom(show: ShowResult): Watch {
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
    month: currentMonth(),
    status: 'watching',
    ratings: { p1: null, p2: null },
    isRewatch: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export default function App() {
  const [auth, setAuth] = useState<Auth>(CLOUD_ENABLED ? { state: 'checking' } : { state: 'ready', session: null })
  const [watches, setWatches] = useState<Watch[]>([])
  const [offline, setOffline] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(currentMonth())
  const [detail, setDetail] = useState<{ watch: Watch; isNew: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
      setWatches(await store.load())
      setOffline(false)
    } catch {
      // Cloud unreachable: fall back to the last synced copy
      setWatches(cache.read())
      setOffline(true)
    }
  }, [])

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

  async function persist(next: Watch, okMsg: string) {
    const prev = watches
    setWatches((list) => [...list.filter((x) => x.id !== next.id), next])
    try {
      await store.save(next)
      flash(okMsg)
      return true
    } catch {
      setWatches(prev)
      flash("Couldn't save. Check your connection and try again.")
      return false
    }
  }

  async function handleSave(w: Watch) {
    setSaving(true)
    const ok = await persist(w, detail?.isNew ? `${w.showName} added to ${monthLabel(w.month)}` : 'Saved')
    setSaving(false)
    if (ok) {
      setDetail(null)
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
    return <div className="app"><p className="muted center pad-top">Loading…</p></div>
  }

  if (auth.state === 'signedOut') {
    return (
      <div className="app">
        {auth.error && <p className="error banner" role="alert">{auth.error}</p>}
        <Login
          onSignIn={async (email, password) => {
            const session = await signIn(email, password)
            setAuth({ state: 'ready', session })
          }}
        />
      </div>
    )
  }

  const me = auth.session?.person ?? null

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
            me={me}
            saving={saving}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setDetail(null)}
          />
        ) : tab === 'home' ? (
          <Home
            watches={watches}
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
          <Search watches={watches} onPick={(show) => setDetail({ watch: draftFrom(show), isNew: true })} />
        ) : tab === 'stats' ? (
          <Stats watches={watches} onOpen={(w) => setDetail({ watch: w, isNew: false })} />
        ) : (
          <Settings
            mode={store.mode}
            session={auth.session}
            watches={watches}
            onSignOut={async () => {
              await signOut()
              setWatches([])
              setAuth({ state: 'signedOut' })
            }}
          />
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      {!detail && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
