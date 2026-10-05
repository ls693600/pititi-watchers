import { useCallback, useEffect, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, byUpdatedDesc, currentMonth, monthLabel, newId } from './logic'
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

type Tab = 'home' | 'search' | 'stats' | 'settings'
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'search', icon: 'search', label: 'Add' },
  { id: 'stats', icon: 'chart', label: 'Stats' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
]

type Auth = { state: 'checking' } | { state: 'signedOut'; error?: string } | { state: 'ready'; session: Session | null }

/** New logs start with the same group as your latest log (usually the people you watch with). */
function defaultWatchers(watches: Watch[], people: Person[], me: string | null): string[] {
  const last = [...watches].sort(byUpdatedDesc).find((w) => !me || w.watchedBy.includes(me))
  const known = new Set(people.map((p) => p.id))
  const group = last?.watchedBy.filter((id) => known.has(id)) ?? []
  if (group.length) return group
  return me ? [me] : people.slice(0, 1).map((p) => p.id)
}

function draftFrom(show: ShowResult, month: string, watchedBy: string[]): Watch {
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
    } catch {
      // Cloud unreachable: fall back to the last synced copy
      const snap = cache.read()
      setWatches(snap.watches)
      setPeople(snap.people)
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

  const me = auth.session?.personId ?? null

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
            saving={saving}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setDetail(null)}
          />
        ) : tab === 'home' ? (
          <Home
            watches={watches}
            people={people}
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
              setDetail({ watch: draftFrom(show, month, defaultWatchers(watches, people, me)), isNew: true })
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
            mode={store.mode}
            session={auth.session}
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
