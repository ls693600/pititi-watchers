import { t } from '../i18n'
import { householdLabel } from '../logic'
import type { Household, PartyAnswer, Person, WatchParty } from '../types'
import { answersFor, partyEpisode, whenLabel } from '../watchParty'
import { Avatar } from './Avatar'

// Small and on Home, so it ships with the app; the party room itself loads when opened.

const nameOf = (people: Person[], id: string | null) => people.find((p) => p.id === id)?.name ?? t('Someone')

/** 2 · On Home, under the Family chat: the invitation (or the party that's on) */
export function PartyCard({ party, answers, people, households, me, onAnswer, onOpen }: {
  party: WatchParty
  answers: PartyAnswer[]
  people: Person[]
  households: Household[]
  me: string
  onAnswer: (a: PartyAnswer['answer']) => void
  onOpen: () => void
}) {
  const { joined, no } = answersFor(party, answers)
  const mine = joined.includes(me) ? 'join' : no.includes(me) ? 'no' : null
  const host = householdLabel(households.find((h) => h.id === party.hostHouseholdId), people)
  const live = party.state === 'playing' || party.state === 'paused'
  const what = [party.title, partyEpisode(party)].filter(Boolean).join(' ')
  return (
    <section className={`party-card ${live ? 'live' : ''}`} aria-label={t('Watch party')}>
      <p className="party-card-kicker">
        🎉 {live ? t('Watch party · on now') : t('Watch party · {when}', { when: whenLabel(party.startsAt) })}
      </p>
      <b className="party-card-title">{t('{host} · {what}', { host, what })}</b>
      <p className="party-card-who">
        {joined.length ? (
          <>
            <span className="party-avatars" aria-hidden="true">
              {joined.slice(0, 5).map((id) => <Avatar key={id} people={people} id={id} size={22} />)}
            </span>
            {t('{names} in', { names: joined.map((id) => (id === me ? t('You') : nameOf(people, id))).join(', ') })}
          </>
        ) : (
          t('Nobody has answered yet')
        )}
      </p>
      {mine == null && !live ? (
        <div className="party-card-actions">
          <button type="button" className="btn primary" onClick={() => onAnswer('join')}>{t('Join')}</button>
          <button type="button" className="btn ghost" onClick={() => onAnswer('no')}>{t("Can't make it")}</button>
        </div>
      ) : (
        <div className="party-card-actions">
          <button type="button" className="btn primary" onClick={onOpen}>{live ? t('Open the party') : t('Open')}</button>
          {mine === 'no' && !live && (
            <button type="button" className="btn ghost" onClick={() => onAnswer('join')}>{t('I can make it after all')}</button>
          )}
        </div>
      )}
    </section>
  )
}
