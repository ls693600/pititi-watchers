import { MATCH_MIN_SHARED, type Badge, type TasteMatch } from '../logic'
import type { Person } from '../types'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'

function verdictFor(score: number): string {
  if (score >= 90) return 'Practically the same brain'
  if (score >= 75) return 'Great taste match'
  if (score >= 60) return 'Mostly on the same page'
  return 'Opposites attract'
}

export function TasteCard({ match, people, big = false }: { match: TasteMatch; people: Person[]; big?: boolean }) {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone'
  const locked = match.shared < MATCH_MIN_SHARED
  const size = big ? 92 : 64
  return (
    <div className={`match ${big ? 'big' : ''}`}>
      <div
        className="ring"
        style={{
          width: size,
          height: size,
          background: locked
            ? 'var(--surface-2)'
            : `conic-gradient(var(--brand) 0 ${match.score}%, var(--surface-2) ${match.score}% 100%)`,
        }}
        role="img"
        aria-label={locked ? 'Locked' : `${match.score}% match`}
      >
        <div style={{ width: size - (big ? 18 : 14), height: size - (big ? 18 : 14), fontSize: big ? 24 : 16 }}>
          {locked ? <Icon name="lock" size={big ? 24 : 18} stroke={2.2} /> : `${match.score}%`}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <span className="stack">
          <Avatar people={people} id={match.a} size={big ? 34 : 24} />
          <Avatar people={people} id={match.b} size={big ? 34 : 24} />
        </span>
        <p className="match-names">
          {name(match.a)} & {name(match.b)}
        </p>
        <p className="muted match-sub">
          {locked
            ? `Rate ${MATCH_MIN_SHARED - match.shared} more ${MATCH_MIN_SHARED - match.shared === 1 ? 'show' : 'shows'} together to unlock`
            : `${verdictFor(match.score)}. Agree on ${match.agreed} of ${match.shared}${match.clash ? `, clash on ${match.clash.watch.showName}` : ''}.`}
        </p>
      </div>
    </div>
  )
}

const BADGE_LOOK: Record<string, { icon: IconName; grad: string }> = {
  streak: { icon: 'flame', grad: 'linear-gradient(135deg,#ff4d6d,#ff8a3d)' },
  binge: { icon: 'play', grad: 'linear-gradient(135deg,#5b6cff,#9b5de5)' },
  soulmates: { icon: 'heart', grad: 'linear-gradient(135deg,#12b886,#0ea5e9)' },
  'family-night': { icon: 'users', grad: 'linear-gradient(135deg,#f59f00,#ff6b3d)' },
  debate: { icon: 'sparkle', grad: 'linear-gradient(135deg,#e64980,#9b5de5)' },
  rewatch: { icon: 'repeat', grad: 'linear-gradient(135deg,#0ea5e9,#5b6cff)' },
  explorer: { icon: 'search', grad: 'linear-gradient(135deg,#12b886,#94d82d)' },
  'night-owl': { icon: 'moon', grad: 'linear-gradient(135deg,#3b2a6b,#5b6cff)' },
  centurion: { icon: 'crown', grad: 'linear-gradient(135deg,#f5a524,#ff4d6d)' },
}

export function BadgeTile({ badge }: { badge: Badge }) {
  const look = BADGE_LOOK[badge.id] ?? BADGE_LOOK.streak
  return (
    <div className={`bdg ${badge.earned ? '' : 'locked'}`} aria-label={`${badge.title}: ${badge.earned ? 'earned' : `${badge.progress} of ${badge.target}`}`}>
      <div className="medal" style={{ background: badge.earned ? look.grad : 'var(--surface-3)' }}>
        <Icon name={look.icon} size={24} stroke={2} />
      </div>
      <b>{badge.title}</b>
      <small>{badge.detail}</small>
      {!badge.earned && (
        <span className="bdg-progress" aria-hidden="true">
          <i style={{ width: `${(badge.progress / badge.target) * 100}%` }} />
        </span>
      )}
    </div>
  )
}
