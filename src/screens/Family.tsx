import type { ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PosterFill, Poster } from '../components/Poster'
import { averageRating, canSeeList, familyFeed, householdLabel, timeAgo } from '../logic'
import { t } from '../i18n'
import type { Household, Person, Recommendation, Watch, WatchList } from '../types'

interface Props {
  view: 'activity' | 'chats'
  onView: (v: 'activity' | 'chats') => void
  /** Unread chat messages, for the Chats badge */
  unread: number
  /** The Chats screen (Messages), rendered as is */
  chats: ReactNode
  watches: Watch[]
  lists: WatchList[]
  recs: Recommendation[]
  people: Person[]
  households: Household[]
  me: Person | undefined
  /** A household's page */
  household: string | null
  onHousehold: (id: string | null) => void
  onOpenWatch: (w: Watch) => void
  onOpenList: (id: string) => void
  onAnswer: (r: Recommendation, status: 'added' | 'dismissed') => void
}

const kindLabel = (k: 'tv' | 'movie') => (k === 'movie' ? t('a movie') : t('a show'))

/** The family circle: what the other households are watching, recommendations, votes, and chats. */
export function Family(props: Props) {
  const { view, onView, unread, chats, watches, lists, recs, people, households, me, household, onHousehold, onOpenWatch, onOpenList, onAnswer } = props
  const nameOf = (id: string) => (id === me?.id ? t('You') : (people.find((p) => p.id === id)?.name ?? t('Someone')))
  const others = households.filter((h) => h.id !== me?.householdId)
  const newRecs = recs.filter((r) => r.to === me?.id && r.status === 'new').length

  if (household) {
    const h = households.find((x) => x.id === household)
    const theirs = watches.filter((w) => w.householdId === household).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const theirLists = lists.filter((l) => l.householdId === household && canSeeList(l, me))
    const members = people.filter((p) => p.householdId === household)
    return (
      <div className="screen">
        <header className="thread-head">
          <button className="icon-btn" aria-label={t('Back')} onClick={() => onHousehold(null)}>
            <Icon name="left" size={20} />
          </button>
          <div className="thread-show" style={{ flex: 1 }}>
            <span className="stack">
              {members.map((p) => (
                <Avatar key={p.id} people={people} id={p.id} size={36} />
              ))}
            </span>
            <span>
              <b>{householdLabel(h, people)}</b>
              <small>{t('{n} shows and movies', { n: theirs.length })}</small>
            </span>
          </div>
        </header>

        {theirLists.length > 0 && (
          <>
            <h2 className="h2">{t('Their lists')}</h2>
            <ul className="list-cards">
              {theirLists.map((l) => (
                <li key={l.id}>
                  <button className="list-card" onClick={() => onOpenList(l.id)}>
                    <span className="list-emoji" aria-hidden="true">{l.emoji}</span>
                    <span className="list-card-text">
                      <b>{t(l.name)}</b>
                    </span>
                    {l.askVotes && <span className="pill-vote">🗳️ {t('Vote')}</span>}
                    <Icon name="right" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="h2">{t('What they watched')}</h2>
        {h && !h.shareLog ? (
          <p className="muted">{t('They keep their watch log private.')}</p>
        ) : theirs.length === 0 ? (
          <p className="muted">{t('Nothing logged yet.')}</p>
        ) : (
          <div className="grid">
            {theirs.map((w) => {
              const avg = averageRating(w)
              return (
                <div key={w.id} className="pcard">
                  <div className="pcard-img">
                    <button className="pcard-hit" onClick={() => onOpenWatch(w)} aria-label={w.showName}>
                      <PosterFill src={w.poster} name={w.showName} />
                    </button>
                    {avg != null && (
                      <span className="pcard-rating">
                        <b>★</b>
                        {avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span className="pcard-title">{w.showName}</span>
                  <span className="pcard-sub">{w.status === 'done' ? t('Finished') : t('Watching')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const feed = familyFeed(watches, lists, recs, me)
  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t('Your family circle')}</p>
          <h1 className="title-xl">{t('Family')}</h1>
        </div>
      </header>

      <div className="segmented wide" role="tablist" aria-label={t('Family')}>
        <button role="tab" aria-selected={view === 'activity'} className={view === 'activity' ? 'on' : ''} onClick={() => onView('activity')}>
          {t('Activity')}
          {newRecs > 0 && <i className="seg-badge">{newRecs}</i>}
        </button>
        <button role="tab" aria-selected={view === 'chats'} className={view === 'chats' ? 'on' : ''} onClick={() => onView('chats')}>
          {t('Chats')}
          {unread > 0 && <i className="seg-badge">{unread}</i>}
        </button>
      </div>

      {view === 'chats' ? (
        chats
      ) : (
        <>
          {others.length > 0 && (
            <div className="house-row" role="list" aria-label={t('Households')}>
              {others.map((h) => (
                <button key={h.id} role="listitem" className="house-chip" onClick={() => onHousehold(h.id)}>
                  <span className="stack">
                    {people
                      .filter((p) => p.householdId === h.id)
                      .slice(0, 3)
                      .map((p) => (
                        <Avatar key={p.id} people={people} id={p.id} size={26} />
                      ))}
                  </span>
                  <span>{householdLabel(h, people)}</span>
                </button>
              ))}
            </div>
          )}

          {feed.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="users" size={30} />
              </div>
              <p className="empty-title">{t('Quiet for now')}</p>
              <p className="muted" style={{ fontSize: 15 }}>
                {t('When the family finishes shows, recommends something to you or asks for votes, it shows up here.')}
              </p>
            </div>
          ) : (
            <ul className="feed">
              {feed.map((e) =>
                e.kind === 'rec' ? (
                  <li key={`r${e.rec.id}`} className="feed-card rec">
                    <Poster src={e.rec.poster} name={e.rec.title} w={64} />
                    <div className="feed-body">
                      <p className="feed-kicker">
                        <Avatar people={people} id={e.rec.from} size={18} /> {t('{who} recommends {what}', { who: nameOf(e.rec.from), what: kindLabel(e.rec.kind) })}
                      </p>
                      <b className="feed-title">
                        {e.rec.title}
                        {e.rec.year ? <span className="muted"> · {e.rec.year}</span> : null}
                      </b>
                      {e.rec.note && <p className="feed-note">“{e.rec.note}”</p>}
                      <div className="feed-actions">
                        <button className="btn sm primary" aria-label={t('Add {title} to Up Next', { title: e.rec.title })} onClick={() => onAnswer(e.rec, 'added')}>
                          <Icon name="plus" size={15} stroke={2.6} /> {t('Up Next')}
                        </button>
                        <button className="btn sm ghost-dark" aria-label={t('Not for me')} onClick={() => onAnswer(e.rec, 'dismissed')}>
                          {t('Not for me')}
                        </button>
                      </div>
                    </div>
                  </li>
                ) : e.kind === 'votes' ? (
                  <li key={`v${e.list.id}`}>
                    <button className="feed-card votes" onClick={() => onOpenList(e.list.id)}>
                      <span className="list-emoji big" aria-hidden="true">{e.list.emoji}</span>
                      <div className="feed-body">
                        <p className="feed-kicker">
                          🗳️ {t('{who} asks for votes', { who: householdLabel(households.find((h) => h.id === e.list.householdId), people) })}
                        </p>
                        <b className="feed-title">{t(e.list.name)}</b>
                        <p className="muted small">{t('Help them pick what to watch')}</p>
                      </div>
                      <span className="pill-vote">{t('Vote')}</span>
                    </button>
                  </li>
                ) : (
                  <li key={`f${e.watch.id}`}>
                    <button className="feed-card" onClick={() => onOpenWatch(e.watch)}>
                      <Poster src={e.watch.poster} name={e.watch.showName} w={52} />
                      <div className="feed-body">
                        <p className="feed-kicker">
                          {householdLabel(households.find((h) => h.id === e.watch.householdId), people)} · {timeAgo(e.at)}
                        </p>
                        <b className="feed-title">
                          {t('Finished {title}', { title: e.watch.showName })}
                          {e.watch.kind !== 'movie' && <span className="muted"> · S{e.watch.season}</span>}
                        </b>
                        {e.avg != null ? (
                          <p className="feed-stars">
                            ★ {e.avg.toFixed(1)} <span className="muted">{e.watch.watchedBy.length > 1 ? t('their average') : t('stars')}</span>
                          </p>
                        ) : (
                          <p className="muted small">{t('Ratings coming')}</p>
                        )}
                      </div>
                      <Icon name="right" size={16} />
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
