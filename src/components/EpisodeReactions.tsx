import { useState } from 'react'
import { t } from '../i18n'
import { bestEpisode, episodeTallies } from '../logic'
import { EPISODE_EMOJIS, type EpisodeEmoji, type EpisodeReaction, type Kind, type Person } from '../types'
import { Avatar } from './Avatar'

/** "How was it?" in words, for screen readers and the picker's labels. */
const emojiName = (e: EpisodeEmoji): string =>
  ({ '🤯': t('Mind-blowing'), '😭': t('Made me cry'), '😂': t('Funny'), '😍': t('Loved it'), '🥱': t('Boring') })[e]

/** The five emoji buttons. `mine` is highlighted; tapping it again takes it back. */
export function EmojiRow({ mine, label, onPick }: { mine: EpisodeEmoji | null; label: string; onPick: (e: EpisodeEmoji) => void }) {
  return (
    <div className="ep-emojis" role="group" aria-label={label}>
      {EPISODE_EMOJIS.map((e) => (
        <button key={e} type="button" className={mine === e ? 'on' : ''} aria-pressed={mine === e} aria-label={emojiName(e)} onClick={() => onPick(e)}>
          {e}
        </button>
      ))}
    </div>
  )
}

interface Props {
  kind: Kind
  showId: number
  season: number
  /** Episodes this log has watched: those can get your emoji */
  watched: number
  finished: boolean
  /** Episode names from TVmaze, when known */
  names: Record<number, string | undefined>
  reactions: EpisodeReaction[]
  people: Person[]
  me: string | null
  canReact: boolean
  onReact: (episode: number, emoji: EpisodeEmoji) => void
}

/** On a show's page: every watched episode with the family's top emoji, the season's best, and your own pick. */
export function EpisodeReactions({ kind, showId, season, watched, finished, names, reactions, people, me, canReact, onReact }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  const tallies = episodeTallies(reactions, kind, showId, season)
  const best = bestEpisode(tallies)
  const shown = Array.from({ length: Math.max(watched, ...tallies.keys(), 0) }, (_, i) => i + 1)
  if (!shown.length) return null
  const nameOf = (id: string) => (id === me ? t('You') : (people.find((p) => p.id === id)?.name ?? t('Someone')))
  const mineFor = (ep: number) => reactions.find((r) => r.kind === kind && r.showId === showId && r.season === season && r.episode === ep && r.personId === me)?.emoji ?? null
  const picked = open != null ? tallies.get(open) : undefined

  return (
    <section className="card pad ep-react" aria-labelledby="ep-react-title">
      <div className="eps-head">
        <b id="ep-react-title">{t('How was each episode?')}</b>
        {canReact && <span className="muted">{t('Tap one to add yours')}</span>}
      </div>
      {best && (
        <p className="ep-best">
          <span aria-hidden="true">🏆</span>{' '}
          {finished ? t('Best episode of S{season}: E{n}', { season, n: best.episode }) : t('Best so far: E{n}', { n: best.episode })}
          <span className="muted">
            {' · '}
            {best.byEmoji[best.top]!.length} {best.top}
          </span>
        </p>
      )}
      <div className="ep-chips">
        {shown.map((ep) => {
          const tl = tallies.get(ep)
          const mine = mineFor(ep)
          const label = `${t('Episode {n}', { n: ep })}${names[ep] ? `: ${names[ep]}` : ''}. ${
            tl ? (tl.count === 1 ? t('1 reaction: {emoji}', { emoji: emojiName(tl.top) }) : t('{n} reactions, mostly {emoji}', { n: tl.count, emoji: emojiName(tl.top) })) : t('No reactions yet')
          }`
          return (
            <button
              key={ep}
              type="button"
              className={`ep-chip ${open === ep ? 'open' : ''} ${mine ? 'mine' : ''} ${best?.episode === ep ? 'best' : ''}`}
              aria-expanded={open === ep}
              aria-label={label}
              onClick={() => setOpen(open === ep ? null : ep)}
            >
              <span className="ep-chip-n">E{ep}</span>
              <span className="ep-chip-e" aria-hidden="true">
                {tl ? tl.top : canReact && ep <= watched ? '+' : '–'}
              </span>
            </button>
          )
        })}
      </div>
      {open != null && (
        <div className="ep-detail" aria-live="polite">
          <p className="ep-detail-title">
            {t('Episode {n}', { n: open })}
            {names[open] ? <span className="muted"> · {names[open]}</span> : null}
          </p>
          {canReact && open <= watched && <EmojiRow mine={mineFor(open)} label={t('How was episode {n}?', { n: open })} onPick={(e) => onReact(open, e)} />}
          {picked ? (
            <ul className="ep-who">
              {EPISODE_EMOJIS.filter((e) => picked.byEmoji[e]?.length).map((e) =>
                picked.byEmoji[e]!.map((id) => (
                  <li key={`${e}${id}`}>
                    <Avatar people={people} id={id} size={20} /> {nameOf(id)} <span aria-label={emojiName(e)}>{e}</span>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <p className="muted ep-none">{canReact && open <= watched ? t('Be the first to react.') : t('No reactions yet')}</p>
          )}
        </div>
      )}
    </section>
  )
}
