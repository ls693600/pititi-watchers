import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CLOUD_ENABLED } from './config'
import { addEpisode, averageRating, totalUnread, defaultWatchersFor, finishSeason, joinWatchers, mergeLogs, inProgressFor, reconcileMonths, setOwnRating, canDelete, householdWatches, householdMembers, householdLabel, movieWatch, currentMonth, monthLabel, newId, pendingReveals } from './logic'
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
import { Stats } from './screens/Stats'
import { Lists, ListEditor } from './screens/Lists'
import { Family } from './screens/Family'
import { TitleSheet } from './components/TitleSheet'
import { MovieLog } from './components/MovieLog'
import { useCircle } from './circle'
import { t, useLang } from './i18n'
import { useFestive } from './useFestive'
import { useToast } from './hooks/useToast'
import { usePush } from './hooks/usePush'
import { useReadState } from './hooks/useReadState'
import { useChat } from './hooks/useChat'
import { useFamilyAdmin } from './hooks/useFamilyAdmin'
import { onOutbox, readOutbox, withOutbox } from './store/outbox'
import { setErrorScreen } from './errors'
import { Toast } from './components/Toast'
import { SEEN_KEY, readSet, writeSet } from './lib/seen'
import { announceNew, celebrateBadges } from './lib/announce'
import { FestiveRain } from './components/Festive'
import { clearProblems, cloudStore, currentSession, recentProblems, getInviteCode, getViewerCode, joinOptions, renewInviteCode, signIn, signOut, signUp } from './store/cloud'
import { cache, localStore } from './store/local'
import type { Session } from './store/store'
import type { Comment, ListItem, Person, Reaction, Title, Watch, WatchList } from './types'

// Cloud changes made without signal wait on the phone (and in its offline copy) and sync when it's back
const cloud = withOutbox(cloudStore, localStore)
const store = CLOUD_ENABLED ? cloud : localStore

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

type Auth = { state: 'checking' } | { state: 'signedOut'; error?: string } | { state: 'ready'; session: Session | null }

/** Reveals this phone has already shown. Null on first run. */
const readSeen = () => readSet(SEEN_KEY)
const writeSeen = (seen: Set<string>) => writeSet(SEEN_KEY, seen)

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
  const { toast, flash, dismiss: dismissToast } = useToast()
  /** Changes waiting to sync (made without signal) */
  const [pending, setPending] = useState(0)
  useEffect(() => onOutbox(setPending), [])
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


  // Who's using the app (single-phone mode: the admin), as early as hooks need it
  const sessionPersonId = auth.state === 'ready' ? (auth.session?.personId ?? DEV_VIEWER) : null
  const mePerson = people.find((p) => p.id === (sessionPersonId ?? people.find((x) => x.isAdmin)?.id))
  const myHousehold = mePerson?.householdId ?? null
  const circle = useCircle(store, mePerson, flash)
  const takeCircle = circle.take
  const chat = useChat(store, mePerson?.id ?? null, flash)
  const { comments, reactions, social } = chat
  const takeChat = chat.take

  // Restore an existing session on launch
  useEffect(() => {
    if (!CLOUD_ENABLED) return
    currentSession()
      .then((session) => setAuth(session ? { state: 'ready', session } : { state: 'signedOut' }))
      .catch((e: Error) => setAuth({ state: 'signedOut', error: e.message }))
  }, [])

  const checkBadges = useCallback((list: Watch[]) => celebrateBadges(list, flash), [flash])

  const { lastRead, markRead } = useReadState()
  /** Open chat on the Messages tab: undefined = the list, null = Family chat, id = a show's chat */
  const [thread, setThread] = useState<string | null | undefined>(undefined)
  const openThread = useCallback((watchId: string | null | undefined) => {
    setActionsFor(null)
    setDetail(null)
    setThread(watchId)
    setFamilyView('chats')
    setTabState('family')
  }, [])

  const { push, turnOn: turnOnPush, turnOff: turnOffPush } = usePush(store, auth.state === 'ready', flash)

  /** Opens a show page from a message, scrolled to its family chat. */
  const openShow = useCallback((w: Watch) => {
    setActionsFor(null)
    setDetail({ watch: w, isNew: false })
    // After the page's own scroll-to-top on open
    setTimeout(() => document.querySelector('.chat')?.scrollIntoView({ block: 'center' }), 600)
  }, [])

  /** "Ana on Severance: …" for chat lines and reactions that arrived since this phone last looked. */
  const announce = useCallback(
    (snap: { watches: Watch[]; people: Person[]; reactions: Reaction[]; comments: Comment[] }) =>
      announceNew(snap, viewerRef.current ?? snap.people.find((p) => p.isAdmin)?.id ?? null, { flash, openShow, openThread }),
    [flash, openShow, openThread],
  )

  const reload = useCallback(async () => {
    try {
      // Send what waited offline first, so the fresh copy already includes it
      if (CLOUD_ENABLED && readOutbox().length) {
        const { sent, dropped } = await cloud.flush()
        if (dropped) flash(t("{n} offline changes couldn't be saved (no permission).", { n: dropped }))
        else if (sent) flash(t('Back online: {n} changes synced', { n: sent }))
      }
      const snap = await store.load()
      setWatches(snap.watches)
      setPeople(snap.people)
      takeCircle(snap)
      takeChat(snap)
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
      takeChat({ comments: snap.comments, reactions: snap.reactions })
      setOffline(true)
    }
  }, [queueReveals, checkBadges, announce, takeCircle, takeChat, flash])
  const familyAdmin = useFamilyAdmin(store, reload, flash)

  useEffect(() => {
    if (auth.state !== 'ready') return
    reload()
    const unsubscribe = store.subscribe(reload)
    const onFocus = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onFocus)
    // Signal is back: sync what waited and refresh
    window.addEventListener('online', reload)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('online', reload)
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

  // Problem reports say where it happened
  useEffect(() => setErrorScreen(detail ? (detail.isNew ? 'new log' : 'show page') : tab), [tab, detail])

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

  async function restoreLog(w: Watch, lines: Comment[] = [], reacts: Reaction[] = []) {
    setWatches((list) => [...list.filter((x) => x.id !== w.id), w])
    try {
      await store.save(w)
      await chat.restore(w.id, lines, reacts)
      flash(t('{name} is back', { name: w.showName }))
    } catch {
      setWatches((list) => list.filter((x) => x.id !== w.id))
      flash(t("Couldn't bring it back. Check your connection."))
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
      {(offline || pending > 0) && (
        <p className="banner warn" role="status">
          {pending > 0
            ? t('Offline · {n} changes saved on this phone will sync when you\'re back online', { n: pending })
            : t('Offline. Showing your last synced log.')}
        </p>
      )}
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
            onSwitchLog={(w, isNew) => setDetail({ watch: w, isNew })}
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
            onReact={(targetId, emoji) => chat.react(detail.watch.id, targetId, emoji)}
            onComment={(text) => chat.send(detail.watch.id, text)}
            onRemoveComment={chat.remove}
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
                onSend={chat.send}
                onRemove={chat.remove}
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
            problems={store.mode === 'cloud' ? { load: recentProblems, clear: clearProblems } : null}
            admin={familyAdmin}
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
          onOpenExisting={(w) => {
            setQuick(null)
            setFromItem(null)
            setDetail({ watch: w, isNew: false })
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
          onReact={(targetId, emoji) => chat.react(reveals[0], targetId, emoji)}
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

      {toast && <Toast toast={toast} onDismiss={dismissToast} />}

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
                  // "Family, 2 new": the name first, then the count
                  aria-label={tb.id === 'family' && familyBadge > 0 ? `${t(tb.label)}, ${t('{n} new', { n: familyBadge })}` : undefined}
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
                  {tb.id === 'family' && familyBadge > 0 && <i className="tab-badge" aria-hidden="true">{familyBadge > 9 ? '9+' : familyBadge}</i>}
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
