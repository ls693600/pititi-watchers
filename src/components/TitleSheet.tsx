import { useState } from 'react'
import { canEditList, householdLabel } from '../logic'
import { t } from '../i18n'
import type { Household, ListItem, Person, Title, WatchList } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Poster } from './Poster'

interface Props {
  title: Title
  mode: 'save' | 'recommend'
  lists: WatchList[]
  items: ListItem[]
  people: Person[]
  households: Household[]
  me: Person | undefined
  onSave: (listId: string) => void
  onRecommend: (to: string[], note: string) => Promise<boolean>
  onNewList: () => void
  onClose: () => void
}

/** "Save to a list" or "Recommend to someone" for any show or movie. */
export function TitleSheet({ title, mode: start, lists, items, people, households, me, onSave, onRecommend, onNewList, onClose }: Props) {
  const [mode, setMode] = useState(start)
  const [to, setTo] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const mine = lists.filter((l) => canEditList(l, me)).sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  const has = (l: WatchList) => items.some((i) => i.listId === l.id && i.kind === title.kind && i.extId === title.extId)
  const readOnly = me?.isViewer ?? false
  // Everyone but you, grouped by household so the family reads naturally
  const others = people.filter((p) => p.id !== me?.id)
  const groups = [...new Set(others.map((p) => p.householdId ?? ''))].map((h) => ({
    label: h ? householdLabel(households.find((x) => x.id === h), people) : t('Viewers'),
    people: others.filter((p) => (p.householdId ?? '') === h),
  }))

  async function send() {
    setSending(true)
    const ok = await onRecommend(to, note.trim())
    setSending(false)
    if (ok) onClose()
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title.title}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-show">
          <Poster src={title.poster} name={title.title} w={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="label-sm">{title.kind === 'movie' ? t('Movie') : t('TV show')}{title.year ? ` · ${title.year}` : ''}</p>
            <h2 className="sheet-title">{title.title}</h2>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {!readOnly && (
          <div className="segmented wide" role="tablist">
            <button role="tab" aria-selected={mode === 'save'} className={mode === 'save' ? 'on' : ''} onClick={() => setMode('save')}>
              {t('Save to a list')}
            </button>
            <button role="tab" aria-selected={mode === 'recommend'} className={mode === 'recommend' ? 'on' : ''} onClick={() => setMode('recommend')}>
              {t('Recommend')}
            </button>
          </div>
        )}

        {mode === 'save' && !readOnly ? (
          <>
            <ul className="pick-list">
              {mine.map((l) => {
                const on = has(l)
                return (
                  <li key={l.id}>
                    <button
                      disabled={on}
                      onClick={() => {
                        onSave(l.id)
                        onClose()
                      }}
                    >
                      <span className="list-emoji" aria-hidden="true">{l.emoji}</span>
                      <b>{t(l.name)}</b>
                      <span className="muted small">{on ? t('Already there') : ''}</span>
                      <Icon name={on ? 'check' : 'plus'} size={18} stroke={2.4} />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button className="btn ghost block" onClick={onNewList}>
              <Icon name="plus" size={18} stroke={2.4} /> {t('New list')}
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 14.5, marginTop: -4 }}>{t('Who should watch it? They get a notification and can add it to their Up Next.')}</p>
            {groups.map((g) => (
              <div key={g.label}>
                <p className="label-sm" style={{ marginBottom: 6 }}>{g.label}</p>
                <div className="chips" style={{ padding: 0 }} role="group" aria-label={g.label}>
                  {g.people.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={to.includes(p.id)}
                      className={to.includes(p.id) ? 'on' : ''}
                      onClick={() => setTo((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                    >
                      <Avatar people={people} id={p.id} size={22} /> {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {others.length === 0 && <p className="muted small">{t('Nobody else has joined yet.')}</p>}
            <textarea
              className="rec-note"
              value={note}
              maxLength={280}
              placeholder={t('Why they\'ll love it (optional)')}
              aria-label={t('Note')}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn primary block" onClick={send} disabled={!to.length || sending}>
              <Icon name="sparkle" size={18} stroke={2.2} />{' '}
              {sending ? t('Sending…') : to.length > 1 ? t('Recommend to {n} people', { n: to.length }) : t('Recommend')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
