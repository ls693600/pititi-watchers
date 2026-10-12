import { useEffect } from 'react'
import { averageRating, canReact, raters, ratingSpread, verdict } from '../logic'
import { bigPoster } from '../tvmaze'
import type { Person, Reaction, Watch } from '../types'
import { Reactions } from './Reactions'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PosterFill } from './Poster'
import { t } from '../i18n'

const CONFETTI = ['#ffc371', '#ff4d6d', '#7ee2a1', '#9b5de5', '#5b6cff', '#ff8a3d', '#ff4d8d']

/** Full-screen moment when the last watcher rates: everyone's stars flip in, then the family average. */
interface Props {
  watch: Watch
  people: Person[]
  /** Who's looking; null hides reactions (single-phone mode or chat not set up) */
  viewer: string | null
  reactions: Reaction[]
  onReact: (targetId: string, emoji: string) => void
  onClose: () => void
}

export function Reveal({ watch, people, viewer, reactions, onReact, onClose }: Props) {
  const avg = averageRating(watch) ?? 0
  const spread = ratingSpread(watch)
  const ids = raters(watch)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label={t('Ratings revealed for {show}', { show: watch.showName })} onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: spread <= 1 ? 26 : 10 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI[i % CONFETTI.length],
              animationDelay: `${(i % 9) * 0.18}s`,
              animationDuration: `${2.6 + (i % 5) * 0.4}s`,
            }}
          />
        ))}
      </div>
      <p className="reveal-kicker">{t('Everyone rated · the reveal')}</p>
      <div className="reveal-poster">
        {watch.poster ? <img src={bigPoster(watch.poster)!} alt="" /> : <PosterFill src={null} name={watch.showName} />}
      </div>
      <h2 className="reveal-title">
        {watch.showName} <span>· {t('S{season}', { season: watch.season })}</span>
      </h2>
      <div className="reveal-cards">
        {ids.map((id, i) => (
          <div key={id} className="rcard" style={{ animationDelay: `${0.35 + i * 0.25}s`, ['--tilt' as string]: `${i % 2 ? 4 : -4}deg` }}>
            <Avatar people={people} id={id} size={42} />
            <span className="rcard-num">{watch.ratings[id]}</span>
            <span className="rcard-stars" aria-label={watch.ratings[id] === 1 ? t('{n} star', { n: 1 }) : t('{n} stars', { n: watch.ratings[id] })}>
              {'★'.repeat(watch.ratings[id])}
              <span>{'★'.repeat(5 - watch.ratings[id])}</span>
            </span>
            {viewer && (
              <Reactions
                watchId={watch.id}
                targetId={id}
                reactions={reactions}
                people={people}
                me={viewer}
                canReact={canReact(watch, id, viewer)}
                onReact={onReact}
                tone="dark"
              />
            )}
          </div>
        ))}
      </div>
      <div className="reveal-avg" style={{ animationDelay: `${0.5 + ids.length * 0.25}s` }}>
        <strong>{avg.toFixed(1)}</strong>
        <span>{t('family average')}</span>
      </div>
      <span className="verdict" style={{ animationDelay: `${0.8 + ids.length * 0.25}s` }}>
        <Icon name={spread <= 1 ? 'heart' : 'sparkle'} size={18} stroke={2.2} /> {verdict(spread)}
      </span>
      <button
        className="reveal-close"
        onClick={(e) => {
          // The backdrop also closes on tap; don't let one tap skip the next reveal
          e.stopPropagation()
          onClose()
        }}
      >
        {t('Continue')}
      </button>
    </div>
  )
}
