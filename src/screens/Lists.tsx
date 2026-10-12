import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { canEditList, canSeeList, householdLabel, newId, rankedItems, visibilityLabel } from '../logic'
import { t } from '../i18n'
import type { Household, ListItem, ListVisibility, Person, WatchList } from '../types'

interface Props {
  lists: WatchList[]
  items: ListItem[]
  people: Person[]
  households: Household[]
  me: Person | undefined
  /** Open list (deep links from notifications set it) */
  open: string | null
  onOpen: (id: string | null) => void
  onVote: (item: ListItem) => void
  onRemove: (item: ListItem) => void
  /** Log it (we're watching it) */
  onWatch: (item: ListItem, list: WatchList) => void
  /** Search to add to this list */
  onAdd: (list: WatchList) => void
  onSave: (l: WatchList, msg?: string) => Promise<boolean>
  onDelete: (l: WatchList) => void
  /** Save to another list / Recommend */
  onMore: (item: ListItem) => void
}

const EMOJIS = ['🍿', '📌', '🎬', '📺', '❤️', '😂', '👻', '🧸', '🏆', '🌙']

function Voters({ ids, people }: { ids: string[]; people: Person[] }) {
  if (!ids.length) return null
  return (
    <span className="stack" aria-label={ids.map((id) => people.find((p) => p.id === id)?.name).join(', ')}>
      {ids.slice(0, 4).map((id) => (
        <Avatar key={id} people={people} id={id} size={18} />
      ))}
    </span>
  )
}

/** Create or edit a list: name, emoji, who can see it, and "help us pick". */
export function ListEditor({
  list,
  people,
  me,
  onSave,
  onDelete,
  onClose,
}: {
  list: WatchList | null
  people: Person[]
  me: Person | undefined
  onSave: (l: WatchList, msg?: string) => Promise<boolean>
  onDelete: (l: WatchList) => void
  onClose: () => void
}) {
  const [name, setName] = useState(list?.name ?? '')
  const [emoji, setEmoji] = useState(list?.emoji ?? '🍿')
  const [visibility, setVisibility] = useState<ListVisibility>(list?.visibility ?? 'household')
  const [sharedWith, setSharedWith] = useState<string[]>(list?.sharedWith ?? [])
  const [askVotes, setAskVotes] = useState(list?.askVotes ?? false)
  const [busy, setBusy] = useState(false)
  // People outside your household you can share with
  const others = people.filter((p) => p.householdId !== me?.householdId)

  async function save() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    const next: WatchList = {
      id: list?.id ?? newId(),
      householdId: list?.householdId ?? me?.householdId ?? '',
      name: n.slice(0, 40),
      emoji,
      visibility,
      sharedWith: visibility === 'people' ? sharedWith : [],
      askVotes,
      isDefault: list?.isDefault ?? false,
      createdBy: list?.createdBy ?? me?.id ?? null,
      createdAt: list?.createdAt ?? new Date().toISOString(),
    }
    const ok = await onSave(next, list ? t('List saved') : t('{name} created', { name: next.name }))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={list ? t('Edit list') : t('New list')}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h2 className="sheet-title">{list ? t('Edit list') : t('New list')}</h2>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="list-name">
          <span className="list-emoji big" aria-hidden="true">{emoji}</span>
          <input value={name} maxLength={40} placeholder={t('Movie night, Kids, Scary…')} aria-label={t('List name')} onChange={(e) => setName(e.target.value)} autoFocus={!list} />
        </div>
        <div className="emoji-row" role="radiogroup" aria-label={t('Emoji')}>
          {EMOJIS.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={emoji === e} className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>

        <div>
          <p className="label-sm" style={{ marginBottom: 8 }}>{t('Who can see it?')}</p>
          <div className="choice-list" role="radiogroup" aria-label={t('Who can see it?')}>
            {(
              [
                ['household', 'lock', t('Only us'), t('Just your household')],
                ['people', 'users', t('Pick people'), t('Us and the people you choose')],
                ['circle', 'heart', t('Whole family'), t('Every household in the family')],
              ] as const
            ).map(([v, icon, label, sub]) => (
              <button key={v} type="button" role="radio" aria-checked={visibility === v} className={visibility === v ? 'on' : ''} onClick={() => setVisibility(v)}>
                <Icon name={icon} size={18} stroke={2.2} />
                <span>
                  <b>{label}</b>
                  <small>{sub}</small>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </button>
            ))}
          </div>
          {visibility === 'people' && (
            <div className="chips" style={{ padding: '10px 0 0' }} role="group" aria-label={t('Share with')}>
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={sharedWith.includes(p.id)}
                  className={sharedWith.includes(p.id) ? 'on' : ''}
                  onClick={() => setSharedWith((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                >
                  <Avatar people={people} id={p.id} size={22} /> {p.name}
                </button>
              ))}
              {others.length === 0 && <p className="muted small">{t('Nobody else has joined yet.')}</p>}
            </div>
          )}
        </div>

        <div className="field" style={{ borderBottom: 0 }}>
          <span>
            {t('Help us pick')}
            <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>
              {visibility === 'household' ? t('Your household votes on what to watch') : t('Everyone who can see it votes, and gets notified')}
            </small>
          </span>
          <button type="button" role="switch" aria-checked={askVotes} aria-label={t('Help us pick')} className={`toggle ${askVotes ? 'on' : ''}`} onClick={() => setAskVotes(!askVotes)} />
        </div>

        <button className="btn primary block" onClick={save} disabled={busy || !name.trim()}>
          {busy ? t('Saving…') : list ? t('Save changes') : t('Create list')}
        </button>
        {list && !list.isDefault && (
          <button
            className="btn danger block"
            onClick={() => {
              onDelete(list)
              onClose()
            }}
          >
            <Icon name="trash" size={18} /> {t('Remove list')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Your household's lists, lists the family shared with you, and votes on what to watch. */
export function Lists({ lists, items, people, households, me, open, onOpen, onVote, onRemove, onWatch, onAdd, onSave, onDelete, onMore }: Props) {
  const [picked, setPicked] = useState<ListItem | null>(null)
  const [editing, setEditing] = useState<WatchList | 'new' | null>(null)
  const visible = lists.filter((l) => canSeeList(l, me))
  const ours = visible
    .filter((l) => !me?.householdId || l.householdId === me.householdId || !l.householdId)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.localeCompare(b.createdAt))
  const theirs = visible.filter((l) => !ours.includes(l)).sort((a, b) => Number(b.askVotes) - Number(a.askVotes) || b.createdAt.localeCompare(a.createdAt))
  const owner = (l: WatchList) => householdLabel(households.find((h) => h.id === l.householdId), people)
  const readOnly = me?.isViewer ?? false
  const editor = editing && (
    <ListEditor list={editing === 'new' ? null : editing} people={people} me={me} onSave={onSave} onDelete={onDelete} onClose={() => setEditing(null)} />
  )

  const list = open ? visible.find((l) => l.id === open) : undefined
  if (open && list) {
    const mine = canEditList(list, me)
    const ranked = rankedItems(items, list.id)
    const lead = ranked[0]
    return (
      <div className="screen">
        <header className="thread-head">
          <button className="icon-btn" aria-label={t('Back to lists')} onClick={() => onOpen(null)}>
            <Icon name="left" size={20} />
          </button>
          <div className="thread-show" style={{ flex: 1 }}>
            <span className="list-emoji" aria-hidden="true">{list.emoji}</span>
            <span>
              <b>{t(list.name)}</b>
              <small>
                {mine ? visibilityLabel(list, people) : owner(list)} · {ranked.length} {ranked.length === 1 ? t('title') : t('titles')}
              </small>
            </span>
          </div>
          {mine && (
            <button className="icon-btn" aria-label={t('Edit list')} onClick={() => setEditing(list)}>
              <Icon name="settings" size={20} />
            </button>
          )}
        </header>

        {list.askVotes && (
          <div className="vote-banner">
            <span aria-hidden="true">🗳️</span>
            <p>
              <b>{t('Help us pick')}</b>
              {lead && lead.votes.length > 0
                ? t('{title} is winning with {n} votes. Tap ♡ on what you want.', { title: lead.title, n: lead.votes.length })
                : t('Tap ♡ on what you want to watch.')}
            </p>
          </div>
        )}

        {ranked.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <span style={{ fontSize: 30 }}>{list.emoji}</span>
            </div>
            <p className="empty-title">{t('Nothing here yet')}</p>
            <p className="muted" style={{ fontSize: 15 }}>
              {mine ? t('Add shows and movies you want to watch.') : t('{who} hasn\'t added anything yet.', { who: owner(list) })}
            </p>
            {mine && !readOnly && (
              <button className="btn primary" onClick={() => onAdd(list)}>
                <Icon name="plus" size={18} stroke={2.4} /> {t('Add a show or movie')}
              </button>
            )}
          </div>
        ) : (
          <ul className="queue">
            {ranked.map((item, i) => {
              const voted = me ? item.votes.includes(me.id) : false
              return (
                <li key={item.id} className={`qrow ${i === 0 && item.votes.length > 0 && list.askVotes ? 'lead' : ''}`}>
                  <button className="qrow-main" onClick={() => setPicked(item)} aria-label={t('Options for {title}', { title: item.title })}>
                    <Poster src={item.poster} name={item.title} w={52} />
                    <span className="lrow-text" style={{ flex: 1, minWidth: 0 }}>
                      <span className="lrow-title">{item.title}</span>
                      <span className="muted">
                        {item.kind === 'movie' ? t('Movie') : t('TV show')}
                        {item.year ? ` · ${item.year}` : ''}
                      </span>
                      <Voters ids={item.votes} people={people} />
                    </span>
                  </button>
                  {me && (
                    <button
                      className={`vote-btn ${voted ? 'on' : ''}`}
                      aria-pressed={voted}
                      aria-label={voted ? t('Take back your vote for {title}', { title: item.title }) : t('Vote for {title}', { title: item.title })}
                      onClick={() => onVote(item)}
                    >
                      <Icon name="heart" size={15} stroke={2.4} /> {item.votes.length}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {picked && (
          <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={picked.title}>
            <button className="sheet-dim" aria-label={t('Close')} onClick={() => setPicked(null)} />
            <div className="sheet">
              <div className="grabber" aria-hidden="true" />
              <div className="sheet-show">
                <Poster src={picked.poster} name={picked.title} w={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="label-sm">
                    {picked.kind === 'movie' ? t('Movie') : t('TV show')}
                    {picked.year ? ` · ${picked.year}` : ''}
                  </p>
                  <h2 className="sheet-title">{picked.title}</h2>
                  <Voters ids={picked.votes} people={people} />
                </div>
              </div>
              {mine && !readOnly && (
                <button
                  className="btn primary block"
                  onClick={() => {
                    setPicked(null)
                    onWatch(picked, list)
                  }}
                >
                  <Icon name="play" size={16} stroke={2.4} /> {t("We're watching it")}
                </button>
              )}
              <button
                className="btn block"
                onClick={() => {
                  setPicked(null)
                  onMore(picked)
                }}
              >
                <Icon name="sparkle" size={16} stroke={2.2} /> {readOnly ? t('Recommend') : t('Recommend or save to another list')}
              </button>
              {mine && !readOnly && (
                <button
                  className="btn danger block"
                  onClick={() => {
                    setPicked(null)
                    onRemove(picked)
                  }}
                >
                  <Icon name="trash" size={16} /> {t('Remove from {list}', { list: t(list.name) })}
                </button>
              )}
            </div>
          </div>
        )}

        {mine && !readOnly && ranked.length > 0 && (
          <button className="btn ghost block" onClick={() => onAdd(list)}>
            <Icon name="plus" size={18} stroke={2.4} /> {t('Add a show or movie')}
          </button>
        )}
        {editor}
      </div>
    )
  }

  const card = (l: WatchList, showOwner: boolean) => {
    const its = rankedItems(items, l.id)
    return (
      <li key={l.id}>
        <button className="list-card" onClick={() => onOpen(l.id)}>
          <span className="list-emoji" aria-hidden="true">{l.emoji}</span>
          <span className="list-card-text">
            <b>{t(l.name)}</b>
            <small>
              {l.askVotes && <span className="pill-vote sm">🗳️ {t('Vote')}</span>}
              {showOwner ? owner(l) : visibilityLabel(l, people)} · {its.length} {its.length === 1 ? t('title') : t('titles')}
            </small>
          </span>
          <span className="list-posters" aria-hidden="true">
            {its.slice(0, 3).map((i) => (
              <Poster key={i.id} src={i.poster} name={i.title} w={30} />
            ))}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t('What to watch next')}</p>
          <h1 className="title-xl">{t('Lists')}</h1>
        </div>
        {!readOnly && me?.householdId !== undefined && (
          <button className="icon-btn" aria-label={t('New list')} onClick={() => setEditing('new')}>
            <Icon name="plus" size={20} stroke={2.4} />
          </button>
        )}
      </header>

      {!readOnly && (
        <>
          <h2 className="h2">
            {t('Ours')}
            <small>{t('only your household changes these')}</small>
          </h2>
          <ul className="list-cards">{ours.map((l) => card(l, false))}</ul>
          <button className="btn ghost block" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} stroke={2.4} /> {t('New list')}
          </button>
        </>
      )}

      <h2 className="h2">
        {t('From the family')}
        <small>{theirs.length ? t('vote on what they watch') : ''}</small>
      </h2>
      {theirs.length ? (
        <ul className="list-cards">{theirs.map((l) => card(l, true))}</ul>
      ) : (
        <p className="muted small">{t('When other households share a list with you, it shows up here.')}</p>
      )}
      {editor}
    </div>
  )
}
