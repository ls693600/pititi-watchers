import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { pickTonight, rankUpNext } from '../logic'
import { bigPoster } from '../tvmaze'
import type { Person, UpNextItem } from '../types'

interface Props {
  items: UpNextItem[]
  people: Person[]
  /** Who hearts on this phone */
  me: string | null
  canRemove: (item: UpNextItem) => boolean
  onToggle: (item: UpNextItem) => void
  onLog: (item: UpNextItem) => void
  onRemove: (item: UpNextItem) => void
  onFind: () => void
}

function wantText(item: UpNextItem, people: Person[]): string {
  const names = item.wantedBy.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean) as string[]
  if (!names.length) return 'Nobody has hearted it yet'
  if (names.length === people.length && names.length > 1) return names.length === 2 ? 'You both want this' : `All ${names.length} of you want this`
  if (names.length === 1) return `${names[0]} wants this`
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} want this`
}

export function UpNext({ items, people, me, canRemove, onToggle, onLog, onRemove, onFind }: Props) {
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [pickId, setPickId] = useState<string | null>(null)
  const [actions, setActions] = useState<UpNextItem | null>(null)

  const ranked = rankUpNext(items)
  const pick = ranked.find((i) => i.id === pickId) ?? ranked[0]
  const list = scope === 'mine' && me ? ranked.filter((i) => i.wantedBy.includes(me)) : ranked

  return (
    <div className="screen">
      <header>
        <p className="eyebrow">What should we watch?</p>
        <h1 className="title-xl">Up Next</h1>
      </header>

      {!pick ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="list" size={30} /></div>
          <p className="empty-title">Nothing queued yet</p>
          <p className="muted" style={{ fontSize: 15 }}>
            Find a show and tap the bookmark to save it here. Everyone can heart what they want to watch.
          </p>
          <button className="btn primary" onClick={onFind}>
            <Icon name="search" size={18} stroke={2.4} /> Find a show
          </button>
        </div>
      ) : (
        <>
          <section className="hero pick" aria-label={`Tonight's pick: ${pick.showName}`}>
            {pick.poster && <img src={bigPoster(pick.poster)!} alt="" className="hero-bg" />}
            <Poster src={pick.poster} name={pick.showName} w={96} />
            <div className="hero-body">
              <span className="hero-kicker">
                <Icon name="sparkle" size={12} stroke={2.4} /> Tonight's pick
              </span>
              <span className="hero-title">{pick.showName}</span>
              <span className="hero-sub">{wantText(pick, people)}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button className="hero-plus" onClick={() => onLog(pick)}>
                  <Icon name="play" size={14} stroke={2.4} /> Watch it
                </button>
                {ranked.length > 1 && (
                  <button className="hero-plus ghost" onClick={() => setPickId(pickTonight(ranked, Math.random(), pick.id)?.id ?? null)}>
                    <Icon name="dice" size={15} stroke={2.2} /> Pick again
                  </button>
                )}
              </div>
            </div>
          </section>

          {me && (
            <div className="segmented wide" role="radiogroup" aria-label="Whose list">
              <button role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
                Everyone ({items.length})
              </button>
              <button role="radio" aria-checked={scope === 'mine'} className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>
                Just me ({items.filter((i) => i.wantedBy.includes(me)).length})
              </button>
            </div>
          )}

          {list.length === 0 ? (
            <p className="muted center" style={{ padding: 20 }}>You haven't hearted anything yet. Tap ♡ on a show you want to watch.</p>
          ) : (
            <ul className="card">
              {list.map((item) => {
                const mine = me != null && item.wantedBy.includes(me)
                return (
                  <li key={item.id} className="qrow">
                    <button className="qrow-main" onClick={() => setActions(item)} aria-label={`Options for ${item.showName}`}>
                      <Poster src={item.poster} name={item.showName} w={46} />
                      <span className="lrow-text">
                        <span className="lrow-title">{item.showName}</span>
                        <span className="muted">{[item.year, item.network].filter(Boolean).join(' · ')}</span>
                        {item.wantedBy.length > 0 && (
                          <span className="stack" style={{ marginTop: 4 }}>
                            {item.wantedBy.map((id) => (
                              <Avatar key={id} people={people} id={id} size={20} />
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                    {me && (
                      <button
                        className={`vote-btn ${mine ? 'on' : ''}`}
                        aria-pressed={mine}
                        aria-label={`${mine ? 'Remove your heart from' : 'Heart'} ${item.showName}`}
                        onClick={() => onToggle(item)}
                      >
                        <Icon name="heart" size={15} stroke={2.4} /> {item.wantedBy.length}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {actions && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={actions.showName}>
          <button className="sheet-dim" aria-label="Close" onClick={() => setActions(null)} />
          <div className="sheet">
            <div className="grabber" aria-hidden="true" />
            <div className="sheet-show">
              <Poster src={actions.poster} name={actions.showName} w={56} />
              <div style={{ minWidth: 0 }}>
                <h2 className="sheet-title">{actions.showName}</h2>
                <p className="muted">{wantText(actions, people)}</p>
              </div>
            </div>
            <button
              className="btn primary block"
              onClick={() => {
                const item = actions
                setActions(null)
                onLog(item)
              }}
            >
              <Icon name="play" size={16} stroke={2.4} /> We're watching it
            </button>
            {canRemove(actions) && (
              <button
                className="btn danger block"
                onClick={() => {
                  const item = actions
                  setActions(null)
                  onRemove(item)
                }}
              >
                <Icon name="trash" size={18} /> Remove from Up Next
              </button>
            )}
            <button className="more" onClick={() => setActions(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
