import { useState } from 'react'
import { REACTIONS, reactionGroups } from '../logic'
import type { Person, Reaction } from '../types'
import { Avatar } from './Avatar'

interface Props {
  watchId: string
  /** Whose rating these reactions are on */
  targetId: string
  reactions: Reaction[]
  people: Person[]
  me: string | null
  /** False on your own rating (or before the reveal): reactions are shown, not added */
  canReact: boolean
  onReact: (targetId: string, emoji: string) => void
  /** Reveal screen: light on dark */
  tone?: 'light' | 'dark'
}

/** Emoji chips under someone's stars. Tap a chip to add or remove yours, + for the full set. */
export function Reactions({ watchId, targetId, reactions, people, me, canReact, onReact, tone = 'light' }: Props) {
  const [picking, setPicking] = useState(false)
  const groups = reactionGroups(reactions, watchId, targetId)
  const names = (ids: string[]) => ids.map((id) => (id === me ? 'you' : (people.find((p) => p.id === id)?.name ?? 'someone'))).join(', ')
  const target = people.find((p) => p.id === targetId)?.name ?? 'them'
  // One reaction each: once you've reacted, tap yours to take it back instead of adding another
  const reacted = me != null && groups.some((g) => g.people.includes(me))
  if (!groups.length && !canReact) return null

  return (
    <div className={`reacts ${tone}`} onClick={(e) => e.stopPropagation()}>
      {groups.map((g) => {
        const mine = me != null && g.people.includes(me)
        return (
          <button
            key={g.emoji}
            type="button"
            className={`react-chip ${mine ? 'mine' : ''}`}
            aria-pressed={mine}
            aria-label={`${g.emoji} from ${names(g.people)}`}
            title={names(g.people)}
            disabled={!canReact}
            onClick={() => onReact(targetId, g.emoji)}
          >
            <span className="emoji">{g.emoji}</span>
            {/* Small family, so faces beat counts: you see who reacted */}
            <span className="stack" aria-hidden="true">
              {g.people.slice(0, 3).map((id) => (
                <Avatar key={id} people={people} id={id} size={18} />
              ))}
            </span>
            {g.people.length > 3 && <span>+{g.people.length - 3}</span>}
          </button>
        )
      })}
      {canReact &&
        !reacted &&
        (picking ? (
          <span className="react-picker" role="group" aria-label={`React to ${target}'s stars`}>
            {REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`React ${e}`}
                onClick={() => {
                  onReact(targetId, e)
                  setPicking(false)
                }}
              >
                {e}
              </button>
            ))}
          </span>
        ) : (
          <button type="button" className="react-add" aria-label={`React to ${target}'s stars`} onClick={() => setPicking(true)}>
            <span aria-hidden="true">+</span> React
          </button>
        ))}
    </div>
  )
}
