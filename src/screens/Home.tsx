import { Suspense, useCallback, useState } from 'react'
import { Avatar, PersonFilter } from '../components/Avatar'
import { LongPress } from '../components/LongPress'
import { Icon } from '../components/Icon'
import { PosterFill } from '../components/Poster'
import { ReleaseCarousel } from '../components/ReleaseCarousel'
import { WatchedSheet } from '../components/WatchedSheet'
import { SeasonsSheet } from '../components/SeasonsSheet'
import { WhatsNewCard } from '../components/WhatsNew'
import { WeeklyPicks } from '../components/WeeklyPicks'
import { useBackClose } from '../hooks/useBackClose'
import { ItsBack } from '../components/ItsBack'
import { lovedTitles } from '../forUs'
import type { SeasonInfo } from '../tvmaze'
import { FestiveDeco } from '../components/Festive'
import type { MonthSort, ShowGroup } from '../logic'
import {
  averageRating,
  groupSeasons,
  homeSlice,
  seasonRange,
  isShowHead,
  currentMonth,
  currentlyWatching,
  episodesIn,
  monthLabel,
  pendingRaters,
  shiftMonth,
  summarize,
  watchedByPerson,
  watchesInMonth,
} from '../logic'
import { getLang, setLang, t } from '../i18n'
import type { Comment, Kind, ListItem, Person, Title, Watch } from '../types'
import type { Festive } from '../festive'
import { lazyPart } from '../lib/lazy'

const FestivePicks = lazyPart(() => import('../components/FestiveSheet').then((m) => m.FestivePicks))

interface Props {
  watches: Watch[]
  people: Person[]
  me: string | null
  /** Signed-in person (null in single-phone mode) */
  viewer: string | null
  month: string
  filter: string | null
  onFilter: (id: string | null) => void
  onMonth: (m: string) => void
  onOpen: (w: Watch) => void
  onAddEpisode: (w: Watch) => void
  /** Press and hold a show: quick actions */
  onActions: (w: Watch) => void
  /** Viewer: browse only (no quick actions, no adding) */
  readOnly?: boolean
  /** The family's shows are still loading */
  loading?: boolean
  onAdd: () => void
  onProfile: () => void
  /** Everyone incl. viewers, for your own name and avatar in the header */
  everyone?: Person[]
  /** Today's festive look: greeting card at the top */
  festive?: Festive | null
  /** Family chat strip under the header (null when chat isn't available) */
  familyChat?: { last: Comment | null; unread: number; recent: string[] } | null
  onFamilyChat?: () => void
  /** Festive picks: what's already on the family's lists, and saving one */
  listItems?: ListItem[]
  onSaveTitle?: (title: Title) => void
  /** "Decide together" card (null: not available here) */
  movieNight?: { startedBy: string | null; left: number; match: string | null; active: boolean; onOpen: () => void; onNew: () => void } | null
  /** "It's back": start a finished show's new season */
  onStartSeason?: (head: Watch, season: SeasonInfo) => void
}

const TIP_KEY = 'pititi.tip.hold.v1'

/** What this phone shows on Home (Customize Home). Currently watching always shows. */
interface HomePrefs {
  chat: boolean
  month: boolean
  back: boolean
  picks: boolean
  festive: boolean
}
const PREFS_KEY = 'pititi.home.v1'
const DEFAULT_PREFS: HomePrefs = { chat: true, month: true, back: true, picks: true, festive: true }

function readPrefs(): HomePrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<HomePrefs>) }
  } catch {
    return DEFAULT_PREFS
  }
}

type TonightChip = 'back' | 'forus' | 'week' | 'festive'

function tipSeen(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === '1'
  } catch {
    return true
  }
}

function greeting(now = new Date()): string {
  const h = now.getHours()
  return h < 5 ? t('Late night') : h < 12 ? t('Good morning') : h < 18 ? t('Good afternoon') : t('Good evening')
}

export function Home(props: Props) {
  const { watches, people, me, viewer, month, filter, onFilter, onMonth, onOpen, onAddEpisode, onActions, onAdd, onProfile, readOnly = false, loading = false, everyone = props.people, festive = null, familyChat = null, onFamilyChat, listItems = [], onSaveTitle, onStartSeason, movieNight = null } = props
  const [showTip, setShowTip] = useState(() => !tipSeen())
  /** Tapped a tile: the month's shows, sorted by what was tapped */
  const [breakdown, setBreakdown] = useState<{ sort: MonthSort; kind: Kind | null } | null>(null)
  const [picks, setPicks] = useState(false)
  /** A show with several seasons this month: its seasons */
  const [seasonsFor, setSeasonsFor] = useState<ShowGroup | null>(null)
  const [prefs, setPrefs] = useState<HomePrefs>(readPrefs)
  const [customizing, setCustomizing] = useState(false)
  const savePrefs = (next: HomePrefs) => {
    setPrefs(next)
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      // Applies until the app restarts
    }
  }
  // Tonight: one discovery row at a time. Chips appear only for rows that have something.
  const [backCount, setBackCount] = useState(0)
  const [picksAvail, setPicksAvail] = useState({ forus: false, week: false })
  const onBackCount = useCallback((n: number) => setBackCount(n), [])
  const onPicksAvail = useCallback((a: { forus: boolean; week: boolean }) => setPicksAvail((cur) => (cur.forus === a.forus && cur.week === a.week ? cur : a)), [])
  const chips: { id: TonightChip; label: string }[] = [
    ...(prefs.back && backCount > 0 ? [{ id: 'back' as const, label: `${t("It's back")} · ${backCount}` }] : []),
    ...(prefs.picks && picksAvail.forus ? [{ id: 'forus' as const, label: `♥ ${t('For us')}` }] : []),
    ...(prefs.picks && picksAvail.week ? [{ id: 'week' as const, label: `🔥 ${t('Trending')}` }] : []),
    ...(prefs.festive && festive ? [{ id: 'festive' as const, label: `${festive.emoji} ${t(festive.name)}` }] : []),
  ]
  const [chipPick, setChipPick] = useState<TonightChip | null>(null)
  const chip: TonightChip | null = chips.some((c) => c.id === chipPick) ? chipPick : (chips[0]?.id ?? null)
  const hideTip = () => {
    setShowTip(false)
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {
      // Fine: the tip shows again next time
    }
  }
  const actions = (w: Watch) => {
    if (readOnly) return
    hideTip()
    onActions(w)
  }
  // The month: what you watched together, or what one person watched alone (they add up to the household)
  const mine = people.length < 2 ? watches : homeSlice(watches, filter)
  const list = watchesInMonth(mine, month)
  // Only episodes watched this month count toward this month's numbers
  const sum = summarize(list, month)
  const isCurrent = month === currentMonth()
  // Currently watching is your remote: everything you're in, together or alone
  const watching = currentlyWatching(viewer ? watchedByPerson(watches, viewer) : watches)
  // This month: in-progress shows live on the shelf above, so the grid shows what was finished
  const grid = isCurrent ? list.filter((w) => w.status === 'done') : list
  // One card per show: several seasons fold into one poster that opens them
  const cards = groupSeasons(grid)
  const monthName = monthLabel(month, 'long').split(' ')[0]
  const who = people.find((p) => p.id === filter)
  const meName = everyone.find((p) => p.id === me)?.name

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">{greeting()}{meName ? ',' : ''}</p>
          <h1 className="title-xl">{meName ?? 'Pititi Watchers'}</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="lang-btn"
            onClick={() => setLang(getLang() === 'pt' ? 'en' : 'pt')}
            aria-label={getLang() === 'pt' ? 'Switch to English' : 'Mudar para português'}
            lang={getLang() === 'pt' ? 'en' : 'pt-BR'}
          >
            {getLang() === 'pt' ? 'EN' : 'PT'}
          </button>
          {me && (
            <button className="who-btn" onClick={onProfile} aria-label={t('Your profile and settings')}>
              <Avatar people={everyone} id={me} size={44} />
            </button>
          )}
        </div>
      </header>

      {!loading && <WhatsNewCard />}

      {prefs.chat && familyChat && onFamilyChat && <FamilyChatStrip chat={familyChat} people={everyone} onOpen={onFamilyChat} />}

      {isCurrent && watching.length > 0 && (
        <ReleaseCarousel watching={watching} people={people} onOpen={onOpen} onAddEpisode={onAddEpisode} onActions={actions} readOnly={readOnly} />
      )}

      {seasonsFor && (
        <SeasonsSheet
          group={seasonsFor}
          month={month}
          onOpen={(w) => {
            setSeasonsFor(null)
            onOpen(w)
          }}
          onClose={() => setSeasonsFor(null)}
        />
      )}
      {festive && picks && (
        <Suspense fallback={null}>
          <FestivePicks festive={festive} watches={watches} items={listItems} readOnly={readOnly || !onSaveTitle} onSave={(title) => onSaveTitle?.(title)} onClose={() => setPicks(false)} />
        </Suspense>
      )}

      {prefs.month && (
      <>
      <div className="monthbar">
        <button className="icon-btn" aria-label={t('Previous month')} onClick={() => onMonth(shiftMonth(month, -1))}>
          <Icon name="left" size={20} />
        </button>
        <div className="monthbar-label">
          <strong>{monthLabel(month)}</strong>
          {isCurrent ? (
            <span className="muted">{t('This month')}</span>
          ) : (
            <button className="today-btn" onClick={() => onMonth(currentMonth())}>
              {t('Back to this month')}
            </button>
          )}
        </div>
        <button className="icon-btn" aria-label={t('Next month')} onClick={() => onMonth(shiftMonth(month, 1))} disabled={isCurrent}>
          <Icon name="right" size={20} />
        </button>
      </div>

      <PersonFilter people={people} value={filter} onChange={onFilter} allLabel={t('Together')} soloHint />

      <div className="tiles four">
        {(
          [
            ['episodes', 'tv', 'tv', 17, String(sum.series), sum.series === 1 ? t('show') : t('shows'), t('See the {n} shows watched in {month}', { n: sum.series, month: monthName })],
            ['hours', 'movie', 'film', 16, String(sum.movies), sum.movies === 1 ? t('movie') : t('movies'), t('See the {n} movies watched in {month}', { n: sum.movies, month: monthName })],
            ['episodes', 'tv', 'play', 15, String(sum.episodes), sum.episodes === 1 ? t('episode') : t('episodes'), t('See episodes by show for {month}', { month: monthName })],
            ['hours', null, 'clock', 17, `${sum.hours}h`, t('watched'), t('See time by show for {month}', { month: monthName })],
          ] as const
        ).map(([sort, kind, icon, size, value, label, aria]) => (
          <button
            key={icon}
            className="tile tile-btn"
            onClick={() => setBreakdown({ sort, kind })}
            aria-label={`${value} ${label}. ${aria}`}
            disabled={list.length === 0 || value === '0'}
          >
            <span className="tile-icon"><Icon name={icon} size={size} /></span>
            <span className="tile-more" aria-hidden="true"><Icon name="right" size={15} stroke={2.4} /></span>
            <strong>{value}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {breakdown && (
        <WatchedSheet
          list={list}
          month={month}
          who={who?.name ?? null}
          together={people.length > 1}
          sort={breakdown.sort}
          kind={breakdown.kind}
          onOpen={(w) => {
            setBreakdown(null)
            onOpen(w)
          }}
          onClose={() => setBreakdown(null)}
        />
      )}

      {loading ? null : list.length === 0 && !(isCurrent && watching.length) ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="tv" size={30} /></div>
          <p className="empty-title">
            {who ? t('Nothing {name} watched alone in {month}', { name: who.name, month: monthName }) : isCurrent ? t('Your month starts here') : t('Nothing in {month}', { month: monthLabel(month) })}
          </p>
          <p className="muted" style={{ fontSize: 15 }}>
            {isCurrent ? t('Add what you watched this month and rate it together.') : t('Add what you watched in {month} and rate it together.', { month: monthLabel(month) })}
          </p>
          {!readOnly && (
            <button className="btn primary" onClick={onAdd}>
              <Icon name="plus" size={18} stroke={2.4} /> {t('Add a show')}
            </button>
          )}
        </div>
      ) : (
        <>
          {showTip && !readOnly && (watching.length > 0 || grid.length > 0) && (
            <div className="tip" role="note">
              <span className="tip-icon" aria-hidden="true">
                <Icon name="sparkle" size={16} stroke={2.2} />
              </span>
              <p>
                <b>{t('Tip:')}</b> {t('tap ⋯ on a poster (or press and hold it) to mark episodes, finish it or rate it, without opening it.')}
              </p>
              <button className="icon-btn" aria-label={t('Got it')} onClick={hideTip}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <h2 className="h2">
            {isCurrent ? t('Watched this month') : t('Watched in {month}', { month: monthName })}
            <small>{isCurrent ? (cards.length === 1 ? t('1 finished') : t('{n} finished', { n: cards.length })) : cards.length === 1 ? t('{n} show', { n: cards.length }) : t('{n} shows', { n: cards.length })}</small>
          </h2>
          {grid.length === 0 && (
            <p className="muted" style={{ fontSize: 14.5, marginTop: -8 }}>
              {t('Nothing finished yet this month. Episodes you watch from the shows above still count in the numbers.')}
            </p>
          )}
          <div className="grid">
            {cards.map((g, i) => {
              const w = g.head
              const many = g.logs.length > 1
              const open = () => (many ? setSeasonsFor(g) : onOpen(w))
              const watchers = [...new Set(g.logs.flatMap((x) => x.watchedBy))]
              const avg = averageRating(w)
              // One rating per show: only its latest season asks for it
              const asks = avg == null && isShowHead(watches, w)
              return (
                <LongPress key={w.id} className="pcard" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} onLong={() => actions(w)}>
                  <div className={`pcard-img ${many ? 'stacked' : ''}`}>
                    <button className="pcard-hit" onClick={open} aria-label={many ? t('{name}: see its {n} seasons', { name: w.showName, n: g.logs.length }) : t('Open {name}', { name: w.showName })}>
                      <PosterFill src={w.poster} name={w.showName} />
                    </button>
                    {!readOnly && (
                      <button type="button" className="pcard-more" aria-label={t('Quick actions for {show}', { show: w.showName })} onClick={() => actions(w)}>
                        <span aria-hidden="true">⋯</span>
                      </button>
                    )}
                    {g.logs.some((x) => x.isRewatch) && (
                      <span className="pcard-badge" title={t('Rewatch')} aria-label={t('Rewatch')}>
                        <Icon name="repeat" size={12} stroke={2.6} />
                      </span>
                    )}
                    {watchers.length > 0 && (
                      <span className="pcard-watchers stack" aria-label={t('Watched by')}>
                        {watchers.slice(0, 3).map((id) => (
                          <Avatar key={id} people={people} id={id} size={22} />
                        ))}
                      </span>
                    )}
                    {avg != null && w.status === 'done' && (
                      <span className="pcard-rating"><b>★</b>{avg.toFixed(1)}</span>
                    )}
                    {/* +1 lives on the Currently watching shelf; past months are a record, not a remote */}
                    {w.status === 'watching' && w.totalEpisodes ? (
                      <span className="pcard-progress"><i style={{ width: `${(w.episodesWatched / w.totalEpisodes) * 100}%` }} /></span>
                    ) : null}
                  </div>
                  <button onClick={open} style={{ textAlign: 'left' }}>
                    <span className="pcard-title">{w.showName}</span>
                  </button>
                  <span className={`pcard-sub ${asks && viewer && w.status === 'done' && w.watchedBy.includes(viewer) && w.ratings[viewer] == null ? 'turn' : ''}`}>
                    {w.status === 'watching'
                      ? isCurrent
                        ? t('S{season} · {n} eps', { season: w.season, n: `${w.episodesWatched}${w.totalEpisodes ? `/${w.totalEpisodes}` : ''}` })
                        : t('S{season} · {n} eps in {month}', { season: w.season, n: episodesIn(w, month), month: monthName })
                      : !asks
                        ? seasonRange(g.logs.map((x) => x.season))
                        : viewer && w.watchedBy.includes(viewer) && w.ratings[viewer] == null
                          ? t('Your turn to rate')
                          : t('Waiting for {names}', { names: pendingRaters(w).map((id) => people.find((p) => p.id === id)?.name ?? t('someone')).join(', ') })}
                  </span>
                </LongPress>
              )
            })}
          </div>
        </>
      )}
      </>
      )}

      {!loading && movieNight && (
        <button type="button" className={`night-entry ${movieNight.active ? 'live' : ''}`} onClick={movieNight.onOpen}>
          <span className="night-entry-icon" aria-hidden="true">🍿</span>
          <span className="night-entry-text">
            <b>
              {movieNight.match
                ? t("Tonight's match: {title}", { title: movieNight.match })
                : movieNight.active
                  ? movieNight.startedBy
                    ? t('{name} started movie night', { name: movieNight.startedBy })
                    : t('Your movie night')
                  : t('Decide together')}
            </b>
            <span>
              {movieNight.match
                ? t('You all said yes. Tap to watch it.')
                : movieNight.active
                  ? movieNight.left
                    ? t('{n} posters left · swipe now', { n: movieNight.left })
                    : t("You're done · waiting for the others")
                  : t('Swipe on posters, each on your phone. First title you all like wins.')}
            </span>
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      {!loading && (prefs.back || prefs.picks || (prefs.festive && festive)) && (
        <section className="tonight" aria-labelledby="tonight-title" hidden={!chips.length}>
          <h2 className="h2" id="tonight-title">{t('Tonight')}</h2>
          <div className="tonight-chips" role="tablist" aria-label={t('What to show tonight')}>
            {chips.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={chip === c.id} className={chip === c.id ? 'on' : ''} onClick={() => setChipPick(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          {/* Both stay mounted so each can tell which chips have something; only the chosen one shows */}
          {prefs.back && (
            <div hidden={chip !== 'back'}>
              <ItsBack watches={watches} onOpen={onOpen} onStart={(head, season) => onStartSeason?.(head, season)} readOnly={readOnly || !onStartSeason} bare onCount={onBackCount} />
            </div>
          )}
          {prefs.picks && (
            <div hidden={chip !== 'forus' && chip !== 'week'}>
              <WeeklyPicks watches={watches} items={listItems} readOnly={readOnly || !onSaveTitle} onSave={(title) => onSaveTitle?.(title)} loved={lovedTitles(watches)} tab={chip === 'week' ? 'week' : 'forus'} onAvailable={onPicksAvail} />
            </div>
          )}
          {prefs.festive && festive && chip === 'festive' && (
            <button className={`festive-card festive-${festive.id}`} onClick={() => setPicks(true)} aria-label={t('{name}: see our picks for today', { name: t(festive.name) })}>
          <FestiveDeco festive={festive} />
          <span className="festive-emoji" aria-hidden="true">{festive.emoji}</span>
          <span className="festive-text" aria-hidden="true">
            <b>
              {t(festive.name)}
              {festive.country && <span className="festive-country">{festive.country === 'CA' ? t('🇨🇦 Canada') : t('🇧🇷 Brazil')}</span>}
            </b>
            {t(festive.greeting)}
            <span className="festive-cta">
              {t('See our picks')} <Icon name="right" size={14} stroke={2.6} />
            </span>
          </span>
        </button>
          )}
        </section>
      )}

      {!loading && (
        <button type="button" className="link-btn home-customize" onClick={() => setCustomizing(true)}>
          <Icon name="settings" size={15} /> {t('Customize Home')}
        </button>
      )}
      {customizing && <CustomizeHome prefs={prefs} festive={!!festive} onChange={savePrefs} onClose={() => setCustomizing(false)} />}
    </div>
  )
}

/** Customize Home: which sections this phone shows. Saved on the phone only. */
function CustomizeHome({ prefs, festive, onChange, onClose }: { prefs: HomePrefs; festive: boolean; onChange: (p: HomePrefs) => void; onClose: () => void }) {
  useBackClose(true, onClose)
  const rows: [keyof HomePrefs | null, string, string?][] = [
    [null, t('Currently watching'), t('Always on')],
    ['chat', t('Family chat')],
    ['month', t('This month')],
    ['back', `${t('Tonight')} · ${t("It's back")}`],
    ['picks', `${t('Tonight')} · ${t('For us')} / ${t('Trending')}`],
    ['festive', `${t('Tonight')} · ${t('Festive picks')}`, festive ? undefined : t('Only on special days')],
  ]
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('Customize Home')}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div>
            <h2 className="sheet-title">{t('Customize Home')}</h2>
            <p className="muted small">{t('Only on this phone. Everyone sets their own.')}</p>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <ul className="custom-rows">
          {rows.map(([key, label, note]) => (
            <li key={label}>
              <span>
                {label}
                {note && <small className="muted"> · {note}</small>}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={key ? prefs[key] : true}
                aria-label={label}
                disabled={!key}
                className={`toggle ${key ? (prefs[key] ? 'on' : '') : 'on'}`}
                onClick={() => key && onChange({ ...prefs, [key]: !prefs[key] })}
              >
                <span />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn ghost block" onClick={() => onChange(DEFAULT_PREFS)}>
          {t('Reset to default')}
        </button>
      </div>
    </div>
  )
}

/** Home shortcut to the Family chat: recent faces, the last message and what's unread. */
function FamilyChatStrip({ chat, people, onOpen }: { chat: NonNullable<Props['familyChat']>; people: Person[]; onOpen: () => void }) {
  const { last, unread, recent } = chat
  const sender = last ? (people.find((p) => p.id === last.personId)?.name ?? '?') : null
  return (
    <button
      className={`chat-strip ${unread ? 'unread' : ''}`}
      onClick={onOpen}
      aria-label={unread ? t('Family chat, {n} unread. Open it', { n: unread }) : t('Open the Family chat')}
    >
      {recent.length ? (
        <span className="chat-faces" aria-hidden="true">
          {recent.map((id) => <Avatar key={id} people={people} id={id} size={30} />)}
        </span>
      ) : (
        <span className="family-badge" aria-hidden="true">
          <Icon name="chat" size={20} />
        </span>
      )}
      <span className="chat-strip-text" aria-hidden="true">
        <span className="chat-strip-top">
          <b>{t('Family chat')}</b>
          {unread > 0 && <span className="badge-count">{unread}</span>}
        </span>
        <span className="chat-strip-last">
          {last ? <><b>{sender}:</b> {last.text}</> : t('Everyone in the family, any topic')}
        </span>
      </span>
      <Icon name="right" size={18} />
    </button>
  )
}
