import { useEffect, useRef } from 'react'
import { getLang, t } from '../i18n'
import type { Festive } from '../festive'
import { picksFor, type FestivePick } from '../festivePicks'
import type { ListItem, Title, Watch } from '../types'
import { Icon } from './Icon'
import { PosterFill } from './Poster'
import { PosterPlay } from './TrailerSheet'

interface Props {
  festive: Festive
  /** Your household's logs: picks you already watched say so */
  watches: Watch[]
  /** Everything on the family's lists: picks already saved say so */
  items: ListItem[]
  /** Viewers browse only */
  readOnly?: boolean
  /** Save to a list (opens the usual "Save to a list" sheet) */
  onSave: (title: Title) => void
  onClose: () => void
}

/** Behind the festive card: a hand-picked selection of movies and shows for the day. */
export function FestivePicks({ festive, ...rest }: Props) {
  const name = t(festive.name)
  return (
    <PicksSheet
      {...rest}
      emoji={festive.emoji}
      eyebrow={name}
      title={t('{name} picks', { name })}
      intro={t('We picked a few movies and shows for the occasion. Tap a poster to watch the trailer.')}
      picks={picksFor(festive.id)}
    />
  )
}

type SheetProps = Omit<Props, 'festive'> & {
  emoji?: string
  eyebrow: string
  title: string
  intro: string
  picks: (FestivePick & { score?: number })[]
  /** "kind:extId" of the pick to scroll to and highlight (opened from a poster) */
  focus?: string | null
}

/** A sheet of movie and show picks: trailer on the poster, Save to a list, and what you already watched or saved. */
export function PicksSheet({ watches, items, readOnly = false, onSave, onClose, emoji, eyebrow, title, intro, picks, focus = null }: SheetProps) {
  const pt = getLang() === 'pt'
  const focused = useRef<HTMLLIElement>(null)
  useEffect(() => {
    focused.current?.scrollIntoView({ block: 'center' })
  }, [])

  useEffect(() => {
    // The trailer or "Save to a list" on top closes first
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1 && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const same = (a: Pick<Title, 'kind' | 'extId'>, b: FestivePick) => (a.kind ?? 'tv') === b.kind && a.extId === b.extId
  const watched = (p: FestivePick) => watches.some((w) => (w.kind ?? 'tv') === p.kind && w.showId === p.extId)
  const saved = (p: FestivePick) => items.some((i) => same(i, p))

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet picks-sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="picks-head">
          {emoji && <span className="picks-emoji" aria-hidden="true">{emoji}</span>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="label-sm">{eyebrow}</p>
            <h2 className="sheet-title">{title}</h2>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="picks-intro">{intro}</p>

        <ul className="picks-grid">
          {picks.map((p) => {
            const label = pt ? p.titlePt : p.title
            const isSaved = saved(p)
            const key = `${p.kind}:${p.extId}`
            return (
              <li key={key} className={`pick${focus === key ? ' focused' : ''}`} ref={focus === key ? focused : undefined}>
                <PosterPlay kind={p.kind} extId={p.extId} title={label} year={p.year} chip compact>
                  <span className="pick-poster">
                    <PosterFill src={p.poster} name={label} />
                  </span>
                </PosterPlay>
                {watched(p) && <span className="pick-seen">{t('Watched ✓')}</span>}
                <b className="pick-title">{label}</b>
                <span className="muted small">
                  {[p.kind === 'movie' ? t('Movie') : t('Show'), p.year].filter(Boolean).join(' · ')}
                  {p.score != null && <> · <b className="gold">★</b> {p.score.toFixed(1)}</>}
                </span>
                {!readOnly && (
                  <button
                    className={`btn sm block ${isSaved ? 'pick-saved' : 'primary'}`}
                    onClick={() => onSave({ kind: p.kind, extId: p.extId, title: label, poster: p.poster, year: p.year, genres: p.genres, runtime: p.runtime, network: p.network })}
                    aria-label={isSaved ? t('{title} is on a list. Change lists', { title: label }) : t('Save {title} to a list', { title: label })}
                  >
                    {isSaved ? <><Icon name="check" size={14} stroke={2.6} /> {t('Saved')}</> : <><Icon name="plus" size={14} stroke={2.6} /> {t('Save')}</>}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
